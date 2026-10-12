import io
import os

from fastapi import FastAPI, Header, HTTPException, Request

app = FastAPI(title="RiRu ML", version="0.1.0", docs_url=None, redoc_url=None)

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_EDGE = 1280


def _token() -> str:
    return os.environ.get("ML_SERVICE_TOKEN", "")


def _authorize(authorization: str | None) -> None:
    expected = _token()
    if not expected or authorization != f"Bearer {expected}":
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Invalid service token."},
        )


def _sniff(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


@app.get("/internal/v1/health")
def health(authorization: str | None = Header(default=None)) -> dict[str, str]:
    _authorize(authorization)
    return {"status": "ok", "service": "riru-ml"}


@app.post("/internal/v1/face-scans")
async def face_scans(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    """Analyze one photo. This process does not write a database or a file.

    A missing landmark model returns 503. Landmarks are never invented.
    Quality rejection is HTTP 200 with status rejected_quality.
    """
    _authorize(authorization)
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"code": "PAYLOAD_TOO_LARGE", "message": "Image is larger than 8 MB."},
        )
    payload = await request.body()
    if len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"code": "PAYLOAD_TOO_LARGE", "message": "Image is larger than 8 MB."},
        )
    if _sniff(payload) is None:
        raise HTTPException(
            status_code=415,
            detail={
                "code": "UNSUPPORTED_MEDIA",
                "message": "Send a JPEG, PNG, or WebP image.",
            },
        )

    import numpy as np
    from PIL import Image, ImageOps, UnidentifiedImageError

    from app.detector import ModelMissingError, detect_faces
    from app.face_analysis import analyze

    Image.MAX_IMAGE_PIXELS = 24_000_000
    try:
        opened = ImageOps.exif_transpose(Image.open(io.BytesIO(payload)))
        rgb_image = opened.convert("RGB")
        rgb_image.thumbnail((MAX_EDGE, MAX_EDGE))
        rgb = np.asarray(rgb_image)
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=415,
            detail={
                "code": "UNSUPPORTED_MEDIA",
                "message": "The file could not be decoded as an image.",
            },
        ) from None
    if rgb.ndim != 3 or rgb.shape[2] != 3 or rgb.size == 0:
        raise HTTPException(
            status_code=415,
            detail={"code": "UNSUPPORTED_MEDIA", "message": "The image has no pixels."},
        )

    try:
        faces = detect_faces(rgb)
    except ModelMissingError:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "MODEL_UNAVAILABLE",
                "message": "The face model file is not installed.",
            },
        ) from None
    return analyze(rgb, faces)


@app.post("/internal/v1/ingredient-scans")
async def ingredient_scans(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    """Read one label. This process does not write a database or a file.

    A missing tesseract binary returns 503 OCR_UNAVAILABLE.
    PaddleOCR and any other provider return 503 OCR_PROVIDER_UNSUPPORTED.
    Text is never invented. Too little text is HTTP 200 rejected_quality.
    """
    _authorize(authorization)
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"code": "PAYLOAD_TOO_LARGE", "message": "Image is larger than 8 MB."},
        )
    payload = await request.body()
    if len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"code": "PAYLOAD_TOO_LARGE", "message": "Image is larger than 8 MB."},
        )
    if _sniff(payload) is None:
        raise HTTPException(
            status_code=415,
            detail={
                "code": "UNSUPPORTED_MEDIA",
                "message": "Send a JPEG, PNG, or WebP image.",
            },
        )

    from PIL import Image, ImageOps, UnidentifiedImageError

    from app.ocr import OcrProviderUnsupported, OcrUnavailable, run_ocr

    Image.MAX_IMAGE_PIXELS = 24_000_000
    try:
        opened = ImageOps.exif_transpose(Image.open(io.BytesIO(payload)))
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=415,
            detail={
                "code": "UNSUPPORTED_MEDIA",
                "message": "The file could not be decoded as an image.",
            },
        ) from None
    if opened.size[0] <= 0 or opened.size[1] <= 0:
        raise HTTPException(
            status_code=415,
            detail={"code": "UNSUPPORTED_MEDIA", "message": "The image has no pixels."},
        )
    try:
        return run_ocr(opened)
    except OcrProviderUnsupported:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "OCR_PROVIDER_UNSUPPORTED",
                "message": "This OCR provider is not enabled.",
            },
        ) from None
    except OcrUnavailable:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "OCR_UNAVAILABLE",
                "message": "The OCR program is not installed.",
            },
        ) from None
