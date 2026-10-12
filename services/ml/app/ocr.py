"""Label OCR. Photos are read from memory and are not written to disk.

Deskew is not implemented. This module does not import OpenCV.
Tesseract `eng` is the default. Any other OCR_PROVIDER, including paddle, is refused.
Accuracy is not measured.
"""

from __future__ import annotations

import io
import os
import subprocess

from PIL import Image, ImageOps

SHORT_EDGE = 1200
LONG_EDGE = 2000
MIN_LETTERS = 3


class OcrUnavailable(Exception):
    """The tesseract binary or the English model is not installed."""


class OcrProviderUnsupported(Exception):
    """OCR_PROVIDER is not the bundled tesseract engine."""


def preprocess(image: Image.Image) -> Image.Image:
    """Grayscale, autocontrast, then scale. No deskew."""
    gray = ImageOps.autocontrast(ImageOps.grayscale(image))
    width, height = gray.size
    short = min(width, height)
    long_edge = max(width, height)
    if short <= 0 or long_edge <= 0:
        return gray
    scale = 1.0
    if short < SHORT_EDGE:
        scale = SHORT_EDGE / short
    if long_edge * scale > LONG_EDGE:
        scale = LONG_EDGE / long_edge
    if scale != 1.0:
        gray = gray.resize(
            (max(1, round(width * scale)), max(1, round(height * scale))),
            Image.Resampling.LANCZOS,
        )
    return gray


def _provider() -> str:
    raw = os.environ.get("OCR_PROVIDER", "tesseract").strip().lower()
    return raw or "tesseract"


def tesseract_stdin(image_bytes: bytes) -> str:
    """Run tesseract on stdin so the photo is not a file path."""
    try:
        proc = subprocess.run(
            ["tesseract", "stdin", "stdout", "-l", "eng", "--psm", "6"],
            input=image_bytes,
            capture_output=True,
            timeout=20,
            check=False,
        )
    except FileNotFoundError as exc:
        raise OcrUnavailable("tesseract") from exc
    except subprocess.TimeoutExpired as exc:
        raise OcrUnavailable("timeout") from exc
    if proc.returncode != 0:
        err = proc.stderr.decode("utf-8", "replace").lower()
        if (
            "error opening data file" in err
            or "failed loading language" in err
            or "not found" in err
        ):
            raise OcrUnavailable("tesseract")
        return ""
    return proc.stdout.decode("utf-8", "replace").replace("\x0c", "")


def recognize(image_bytes: bytes) -> str:
    if _provider() != "tesseract":
        raise OcrProviderUnsupported(_provider())
    return tesseract_stdin(image_bytes)


def _letters(text: str) -> int:
    return sum(1 for char in text if ("A" <= char <= "Z") or ("a" <= char <= "z"))


def run_ocr(image: Image.Image) -> dict[str, str]:
    prepared = preprocess(image)
    buffer = io.BytesIO()
    prepared.save(buffer, format="PNG")
    text = recognize(buffer.getvalue())
    if _letters(text) < MIN_LETTERS:
        return {"status": "rejected_quality", "ocrText": ""}
    return {"status": "succeeded", "ocrText": text}
