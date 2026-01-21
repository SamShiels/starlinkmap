FROM python:3.9-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Copy pyproject.toml and lock if exists, but since no lock, uv will create
COPY pyproject.toml .

# Sync dependencies
RUN uv sync

COPY app.py .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]