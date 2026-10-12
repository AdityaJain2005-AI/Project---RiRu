import io
import os

os.environ["ML_SERVICE_TOKEN"] = "test-token"

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.ocr import OcrUnavailable, preprocess

client = TestClient(app)
AUTH = {"Authorization": "Bearer test-token"}


def _png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (48, 32), (240, 240, 240)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_ocr_module_does_not_import_cv2() -> None:
    import app.ocr as ocr
    from pathlib import Path

    source = Path(ocr.__file__).read_text(encoding="utf-8")
    assert "import cv2" not in source
    assert "deskew" in source.lower()


def test_preprocess_scales_without_growing_past_the_long_edge() -> None:
    tiny = preprocess(Image.new("RGB", (40, 20), (12, 12, 12)))
    assert tiny.mode == "L"
    assert max(tiny.size) <= 2000
    assert min(tiny.size) > 20
    huge = preprocess(Image.new("L", (4000, 3000), 128))
    assert max(huge.size) <= 2000


def test_ingredient_scan_requires_token() -> None:
    response = client.post("/internal/v1/ingredient-scans", content=b"\xff\xd8\xff")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "UNAUTHORIZED"


def test_ingredient_scan_rejects_non_image() -> None:
    response = client.post(
        "/internal/v1/ingredient-scans",
        content=b"not-an-image",
        headers=AUTH,
    )
    assert response.status_code == 415
    assert response.json()["detail"]["code"] == "UNSUPPORTED_MEDIA"


def test_missing_tesseract_is_503(monkeypatch) -> None:
    def missing(_image_bytes: bytes) -> str:
        raise OcrUnavailable("tesseract")

    monkeypatch.setattr("app.ocr.recognize", missing)
    response = client.post("/internal/v1/ingredient-scans", content=_png(), headers=AUTH)
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "OCR_UNAVAILABLE"


def test_paddle_is_unsupported(monkeypatch) -> None:
    monkeypatch.setenv("OCR_PROVIDER", "paddle")
    response = client.post("/internal/v1/ingredient-scans", content=_png(), headers=AUTH)
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "OCR_PROVIDER_UNSUPPORTED"


def test_short_text_is_rejected_without_a_fake_list(monkeypatch) -> None:
    monkeypatch.setattr("app.ocr.recognize", lambda _image_bytes: "12")
    response = client.post("/internal/v1/ingredient-scans", content=_png(), headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "rejected_quality"
    assert body["ocrText"] == ""


def test_recognize_text_is_returned_as_is(monkeypatch) -> None:
    monkeypatch.setattr("app.ocr.recognize", lambda _image_bytes: "AQUA, GLYCERIN\n")
    response = client.post("/internal/v1/ingredient-scans", content=_png(), headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["ocrText"] == "AQUA, GLYCERIN\n"
