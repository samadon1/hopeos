# HopeOS Backend - Cloud Run with GPU
# Uses pre-built CUDA wheels (no compilation needed)

FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Install Python (no build tools needed - using pre-built wheels)
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && python -m pip install --upgrade pip

# Set work directory
WORKDIR /app

# Install llama-cpp-python from pre-built CUDA 12.1 wheels
# This avoids needing to compile and link against libcuda.so at build time
RUN pip install --no-cache-dir \
    llama-cpp-python==0.2.90 \
    --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu121

# Install other Python dependencies
RUN pip install --no-cache-dir \
    fastapi>=0.109.0 \
    "uvicorn[standard]>=0.27.0" \
    sqlalchemy>=2.0.25 \
    greenlet>=3.0.0 \
    aiosqlite>=0.19.0 \
    asyncpg>=0.29.0 \
    pydantic>=2.5.3 \
    pydantic-settings>=2.1.0 \
    email-validator>=2.1.0 \
    "python-jose[cryptography]>=3.3.0" \
    bcrypt>=4.0.0 \
    python-multipart>=0.0.6 \
    httpx>=0.26.0 \
    huggingface_hub>=0.20.0

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data && chmod 777 /app/data

# Expose port
EXPOSE 8080

# Run the application
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
