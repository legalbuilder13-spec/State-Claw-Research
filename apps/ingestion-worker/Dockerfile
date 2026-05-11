# Ingestion worker — Python 3.12 + uv + Playwright (for state-legislative-site scraping)
#
# Built and pushed to Railway as a separate service from openclaw-runtime.
# Runs the CLI (one-shot ingest commands) and the long-lived worker mode.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_SYSTEM_PYTHON=1

# System deps for Playwright (chromium needs these even though chromium itself is downloaded by playwright install)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# uv (fast Python package installer)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/uv

WORKDIR /app

# Install Python deps via uv (uses pyproject.toml + uv.lock when present)
COPY pyproject.toml ./
RUN uv pip install --system --no-cache -e .

# Install Playwright browser
RUN python -m playwright install --with-deps chromium

# Copy source after deps are cached
COPY src ./src

# Default to CLI help; Railway overrides via service command
CMD ["agentic-law-os-ingestion", "--help"]
