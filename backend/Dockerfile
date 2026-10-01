# Container image for hosting the pose-analysis API with uvicorn (Render, Hugging
# Face Spaces, any Docker host). Listens on $PORT when the host sets it (Render
# does), otherwise 7860 (HF Spaces' `app_port`). AWS Lambda uses
# Dockerfile.lambda instead.
FROM python:3.11-slim

# System libraries LiteRT (libgomp) and OpenCV-headless (libglib) load at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first so this layer caches across code changes
COPY requirements-space.txt .
RUN pip install --no-cache-dir -r requirements-space.txt

# Only the server, its shared helpers and the trained models are needed to
# serve requests. `utils/` holds the preprocessing/label code the server shares
# with the trainer — without it the app cannot import.
COPY yoga_pose_engine.py .
COPY utils/ ./utils/
COPY models/ ./models/

EXPOSE 7860
# Shell form so ${PORT} is expanded; exec keeps uvicorn as PID 1 for signals.
CMD exec uvicorn yoga_pose_engine:app --host 0.0.0.0 --port ${PORT:-7860}
