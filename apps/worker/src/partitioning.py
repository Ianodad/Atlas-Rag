from __future__ import annotations

import logging
from collections import Counter
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from typing import Any, TypedDict

from .config import Settings, get_settings

logger = logging.getLogger(__name__)


class PartitionElement(TypedDict):
    type: str
    text: str
    table_html: str | None
    image_base64: str | None
    page_number: int | None
    source_element_id: str | None
    element_type: dict[str, Any]
    metadata: dict[str, Any]


class PartitionDiagnostics(TypedDict):
    parser: str
    element_count: int
    elements_by_type: dict[str, int]
    page_count: int | None


class _FallbackHTMLTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []

    def handle_data(self, data: str) -> None:
        cleaned = " ".join(data.split())
        if cleaned:
            self._parts.append(cleaned)

    def text(self) -> str:
        return "\n".join(self._parts)


def _metadata_to_dict(raw_metadata: Any) -> dict[str, Any]:
    if raw_metadata is None:
        return {}
    if hasattr(raw_metadata, "to_dict"):
        return _json_safe(raw_metadata.to_dict())
    if isinstance(raw_metadata, dict):
        return _json_safe(raw_metadata)
    return {}


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]
    return str(value)


def _normalize_type(raw_type: str) -> str:
    normalized = raw_type.lower()
    if normalized in {"title", "header"}:
        return "title"
    if normalized in {"table"}:
        return "table"
    if normalized in {"image", "figurecaption", "picture"}:
        return "image"
    return "paragraph"


def _coerce_page_number(value: Any) -> int | None:
    if value is None:
        return None
    try:
        page_number = int(value)
    except (TypeError, ValueError):
        return None
    return page_number if page_number > 0 else None


def _normalize_element(element: Any) -> PartitionElement:
    metadata = _metadata_to_dict(getattr(element, "metadata", None))
    raw_type = getattr(element, "category", None) or element.__class__.__name__
    return {
        "type": _normalize_type(raw_type),
        "text": str(element).strip(),
        "table_html": metadata.get("text_as_html") or metadata.get("table_as_html"),
        "image_base64": metadata.get("image_base64"),
        "page_number": _coerce_page_number(metadata.get("page_number")),
        "source_element_id": _json_safe(getattr(element, "id", None) or metadata.get("element_id")),
        "element_type": {
            "category": str(raw_type),
            "orig_elements": _json_safe(metadata.get("orig_elements")),
        },
        "metadata": metadata,
    }


def _detect_kind(path: str, mime_type: str | None) -> str:
    suffix = Path(path).suffix.lower().lstrip(".")
    if suffix:
        return suffix
    if mime_type:
        _mime_map = {
            "application/pdf": "pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
            "text/plain": "txt",
            "text/markdown": "md",
        }
        return _mime_map.get(mime_type, "")
    return ""


def _require_unstructured_api_key(settings: Settings) -> str:
    if settings.unstructured_api_key is None:
        raise RuntimeError("UNSTRUCTURED_API_KEY is required for hosted Unstructured API parsing")
    return settings.unstructured_api_key.get_secret_value()


def _resolve_unstructured_ssl_verify(settings: Settings) -> bool | str:
    if not settings.unstructured_ssl_verify:
        return False
    if settings.unstructured_ca_bundle is None or not settings.unstructured_ca_bundle.strip():
        return True
    ca_bundle = Path(settings.unstructured_ca_bundle).expanduser()
    if not ca_bundle.is_file():
        raise RuntimeError(
            f"UNSTRUCTURED_CA_BUNDLE does not exist or is not a file: {ca_bundle}"
        )
    return str(ca_bundle)


def _build_unstructured_api_client(settings: Settings) -> Any:
    import httpx

    return httpx.Client(verify=_resolve_unstructured_ssl_verify(settings), timeout=60.0)


def _unstructured_server_url(api_url: str) -> str:
    suffix = "/general/v0/general"
    if api_url.endswith(suffix):
        return api_url[: -len(suffix)]
    return api_url


def _unstructured_http_error(exc: Exception, settings: Settings) -> RuntimeError:
    message = (
        "Could not connect to the Unstructured API. "
        f"Check network access to {settings.unstructured_api_url}."
    )
    if "CERTIFICATE_VERIFY_FAILED" in str(exc):
        message += (
            " TLS verification failed. If your network uses a custom or self-signed root CA, "
            "set UNSTRUCTURED_CA_BUNDLE to a PEM bundle trusted by this worker, or set "
            "UNSTRUCTURED_SSL_VERIFY=false only for local troubleshooting."
        )
    return RuntimeError(message)


def _partition_via_api(
    *,
    file: Any,
    metadata_filename: str,
    content_type: str | None,
    kind: str,
    settings: Settings,
) -> list[PartitionElement]:
    import httpx
    from unstructured.partition.api import get_retries_config
    from unstructured.staging.base import elements_from_json
    from unstructured_client import UnstructuredClient
    from unstructured_client.models import operations, shared

    kwargs: dict[str, Any] = {
        "files": shared.Files(content=file, file_name=metadata_filename),
    }
    if content_type:
        kwargs["content_type"] = content_type
    if kind == "pdf":
        kwargs["strategy"] = "hi_res"
        kwargs["split_pdf_page"] = True
        kwargs["split_pdf_allow_failed"] = True
        kwargs["split_pdf_concurrency_level"] = 8
        kwargs["extract_image_block_types"] = ["Image", "Table"]

    try:
        with _build_unstructured_api_client(settings) as client:
            sdk = UnstructuredClient(
                api_key_auth=_require_unstructured_api_key(settings),
                server_url=_unstructured_server_url(settings.unstructured_api_url),
                client=client,
            )
            request = operations.PartitionRequest(
                partition_parameters=shared.PartitionParameters(**kwargs)
            )
            retries = get_retries_config(
                retries_connection_errors=None,
                retries_exponent=None,
                retries_initial_interval=None,
                retries_max_elapsed_time=None,
                retries_max_interval=None,
                sdk=sdk,
            )
            response = sdk.general.partition(request=request, retries=retries)
    except httpx.HTTPError as exc:
        raise _unstructured_http_error(exc, settings) from exc
    if response.status_code != 200:
        raise RuntimeError(
            "Unstructured API returned an unexpected response "
            f"({response.status_code}) from {settings.unstructured_api_url}."
        )
    return [_normalize_element(element) for element in elements_from_json(text=response.raw_response.text)]


def _parse_file_with_unstructured_api(
    path: str,
    mime_type: str | None,
    settings: Settings,
) -> tuple[str, list[PartitionElement]]:
    with open(path, "rb") as file:
        elements = _partition_via_api(
            file=file,
            metadata_filename=Path(path).name,
            content_type=mime_type,
            kind=_detect_kind(path, mime_type),
            settings=settings,
        )
    return "unstructured-api", elements


def _parse_url_with_unstructured_api(
    html: str,
    source_url: str | None,
    settings: Settings,
) -> tuple[str, list[PartitionElement]]:
    metadata_filename = "source.html"
    if source_url:
        parsed = Path(source_url.split("?", 1)[0].rstrip("/")).name
        if parsed:
            metadata_filename = parsed if "." in parsed else f"{parsed}.html"
    file = BytesIO(html.encode("utf-8", errors="ignore"))
    elements = _partition_via_api(
        file=file,
        metadata_filename=metadata_filename,
        content_type="text/html",
        kind="html",
        settings=settings,
    )
    return "unstructured-api", elements


def _parse_text_fallback(text: str, source_name: str) -> tuple[str, list[PartitionElement]]:
    stripped = text.strip()
    if not stripped:
        return source_name, []
    return (
        source_name,
        [
            {
                "type": "paragraph",
                "text": stripped,
                "table_html": None,
                "image_base64": None,
                "page_number": None,
                "source_element_id": None,
                "element_type": {"category": "FallbackText", "orig_elements": None},
                "metadata": {},
            }
        ],
    )


def _parse_file_with_unstructured_local(
    path: str,
    mime_type: str | None,
) -> tuple[str, list[PartitionElement]]:
    from unstructured.partition.auto import partition

    # strategy="fast" uses pdfminer/python-docx/python-pptx text extraction,
    # avoiding unstructured-inference (torch/triton) which is not installed.
    elements = partition(filename=path, content_type=mime_type, strategy="fast")
    return "unstructured-local", [_normalize_element(el) for el in elements]


def _parse_pdf_fallback(path: str) -> tuple[str, list[PartitionElement]]:
    from pypdf import PdfReader

    reader = PdfReader(path)
    elements: list[PartitionElement] = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if not text:
            continue
        elements.append(
            {
                "type": "paragraph",
                "text": text,
                "table_html": None,
                "image_base64": None,
                "page_number": page_number,
                "source_element_id": None,
                "element_type": {"category": "FallbackPdf", "orig_elements": None},
                "metadata": {"page_number": page_number},
            }
        )
    return "fallback-pdf", elements


def _parse_file_fallback(
    path: str,
    mime_type: str | None,
    cause: Exception | None = None,
) -> tuple[str, list[PartitionElement]]:
    suffix = Path(path).suffix.lower()
    if (mime_type and mime_type.startswith("text/")) or suffix in {".txt", ".md"}:
        text = Path(path).read_text(encoding="utf-8", errors="ignore")
        return _parse_text_fallback(text, "fallback-text")
    kind = _detect_kind(path, mime_type) or suffix.lstrip(".") or "unknown"
    if kind == "pdf":
        try:
            return _parse_pdf_fallback(path)
        except ImportError as exc:
            raise RuntimeError(
                "PDF partitioning fallback requires `pypdf` in the worker environment. "
                "Run `uv sync` in `apps/worker`."
            ) from exc
        except Exception as exc:
            raise RuntimeError("PDF partitioning fallback failed") from exc
    raise RuntimeError(f"Unstructured is required to partition this file type ({kind})") from cause


def _parse_url_fallback(html: str) -> tuple[str, list[PartitionElement]]:
    parser = _FallbackHTMLTextExtractor()
    parser.feed(html)
    return _parse_text_fallback(parser.text(), "fallback-html")


def parse_file(
    path: str,
    mime_type: str | None,
    settings: Settings | None = None,
) -> tuple[str, list[PartitionElement]]:
    cfg = settings or get_settings()
    try:
        return _parse_file_with_unstructured_api(path, mime_type, cfg)
    except ImportError:
        pass
    except (RuntimeError, Exception) as exc:
        # API unavailable or misconfigured — fall through to local parsing
        logger.warning(
            "Unstructured API unavailable (%s), falling back to local partition", exc
        )
    try:
        return _parse_file_with_unstructured_local(path, mime_type)
    except ImportError as exc:
        return _parse_file_fallback(path, mime_type, exc)


def parse_url(
    html: str,
    source_url: str | None = None,
    settings: Settings | None = None,
) -> tuple[str, list[PartitionElement]]:
    cfg = settings or get_settings()
    try:
        return _parse_url_with_unstructured_api(html, source_url, cfg)
    except (ImportError, RuntimeError, Exception) as exc:
        logger.warning(
            "Unstructured API unavailable (%s), falling back to HTML text extraction", exc
        )
        return _parse_url_fallback(html)


def build_partition_diagnostics(parser_name: str, elements: list[PartitionElement]) -> PartitionDiagnostics:
    counts = Counter(element["type"] for element in elements)
    pages = sorted({page for page in (element.get("page_number") for element in elements) if page is not None})
    return {
        "parser": parser_name,
        "element_count": len(elements),
        "elements_by_type": dict(counts),
        "page_count": pages[-1] if pages else None,
    }
