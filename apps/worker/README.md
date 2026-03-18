# Worker

Background worker for document ingestion and retrieval preparation.

Current responsibilities:

- document partitioning through the hosted Unstructured API
- chunking
- multimodal retrieval summaries
- embeddings
- reprocessing

## Local setup

Install the worker environment:

```bash
cd apps/worker
uv sync
```

This worker sends supported files and fetched URL HTML to the hosted Unstructured Partition API.
Formats used in this repo:

- `pdf`
- `docx`
- `pptx`
- `md`
- `txt`
- `html` and URL ingestion

Python dependencies in use:

- `unstructured`
- `unstructured` (for `partition_via_api`)

Required environment variables:

- `UNSTRUCTURED_API_KEY`
- `UNSTRUCTURED_API_URL` defaults to `https://api.unstructuredapp.io/general/v0/general`
- `UNSTRUCTURED_SSL_VERIFY` defaults to `true`
- `UNSTRUCTURED_CA_BUNDLE` optional path to a PEM CA bundle for networks with custom/self-signed roots

This setup avoids local OCR/inference tooling such as `unstructured-inference`, `torch`, and CUDA packages.
For local PDF fallback, the worker uses lightweight text extraction via `pypdf` instead of inference/OCR packages.

Run the worker:

```bash
uv run python -m src.worker
```

Or from the repo root:

```bash
pnpm dev:worker
```
