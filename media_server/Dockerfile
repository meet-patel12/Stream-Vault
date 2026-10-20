FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Install system dependencies, build tools, FFmpeg with SVT-AV1 & libvmaf support
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    tar \
    xz-utils \
    ffmpeg \
    libvmaf-dev \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Google Shaka Packager
RUN curl -fsSL -o /usr/local/bin/packager https://github.com/shaka-project/shaka-packager/releases/download/v3.4.0/packager-linux-x64 \
    && chmod +x /usr/local/bin/packager

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
