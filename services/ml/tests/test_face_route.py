import io
import os

os.environ["ML_SERVICE_TOKEN"] = "test-token"

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from app.detector import ModelMissingError
from app.main import app
from tests.test_face_analysis import _front_landmarks, _sharp_face

client = TestClient(app)
AUTH = {"Authorization": "Bearer test-token"}


def _png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (48, 48), (180, 140, 120)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_face_scan_requires_token() -> None:
    response = client.post("/internal/v1/face-scans", content=b"\xff\xd8\xff")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "UNAUTHORIZED"


def test_face_scan_rejects_non_image() -> None:
    response = client.post("/internal/v1/face-scans", content=b"not-an-image", headers=AUTH)
    assert response.status_code == 415
    assert response.json()["detail"]["code"] == "UNSUPPORTED_MEDIA"


def test_face_scan_rejects_oversize() -> None:
    payload = b"\xff\xd8\xff" + b"0" * (8 * 1024 * 1024)
    response = client.post("/internal/v1/face-scans", content=payload, headers=AUTH)
    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "PAYLOAD_TOO_LARGE"


def test_missing_model_is_503(monkeypatch) -> None:
    def missing(_rgb: np.ndarray) -> list[np.ndarray]:
        raise ModelMissingError("face_landmarker.task")

    monkeypatch.setattr("app.detector.detect_faces", missing)
    response = client.post("/internal/v1/face-scans", content=_png(), headers=AUTH)
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "MODEL_UNAVAILABLE"


def test_route_returns_analyzer_result(monkeypatch) -> None:
    monkeypatch.setattr("app.detector.detect_faces", lambda _rgb: [_front_landmarks()])
    image = Image.fromarray(_sharp_face())
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    response = client.post("/internal/v1/face-scans", content=buffer.getvalue(), headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["modelVersion"] == "baseline_cv_v1"
    acne = next(item for item in body["findings"] if item["concern"] == "acne")
    assert acne["severity"] == "none"


def test_no_face_from_route(monkeypatch) -> None:
    monkeypatch.setattr("app.detector.detect_faces", lambda _rgb: [])
    response = client.post("/internal/v1/face-scans", content=_png(), headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "rejected_quality"
    assert body["quality"]["reasons"] == ["no_face"]
