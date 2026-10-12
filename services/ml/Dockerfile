FROM python:3.12-slim

WORKDIR /srv

# English Tesseract data is installed here. The process must not download a model at runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng \
 && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 riru

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Pinned MediaPipe Face Landmarker (Apache-2.0). Runtime must not download it.
ENV FACE_LANDMARKER_MODEL=/srv/models/face_landmarker.task
RUN mkdir -p /srv/models \
 && python -c "import urllib.request; urllib.request.urlretrieve('https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', '/srv/models/face_landmarker.task')" \
 && chown -R riru:riru /srv

USER riru
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
