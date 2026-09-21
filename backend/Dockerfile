# Container image for hosting the pose-analysis API (built for Hugging Face
# Spaces, but works on any Docker host). HF Spaces routes public traffic to
# the port declared as `app_port` in README.md (7860).
FROM python:3.11-slim

# System libraries TensorFlow (libgomp) and OpenCV-headless (libglib) load at runtime
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
CMD ["uvicorn", "yoga_pose_engine:app", "--host", "0.0.0.0", "--port", "7860"]
