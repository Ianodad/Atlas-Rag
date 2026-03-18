FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY apps/worker/pyproject.toml ./apps/worker/pyproject.toml
COPY apps/worker/src ./apps/worker/src

WORKDIR /app/apps/worker

RUN uv sync

CMD ["uv", "run", "python", "-m", "src.worker"]
