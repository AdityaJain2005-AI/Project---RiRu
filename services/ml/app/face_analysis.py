"""Baseline visual estimate. Not a clinical model.

Thresholds are engineering defaults. They were not fit on a labeled dataset.
Confidence is capped at 0.55. Acne is not detected.
"""

from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

DISCLAIMER = "Informational only, not a medical diagnosis."
MODEL_VERSION = "baseline_cv_v1"
CONFIDENCE_CAP = 0.55

FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]
LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
OUTER_LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]

REASON_TEXT = {
    "no_face": "No face was detected.",
    "multiple_faces": "More than one face was in the frame.",
    "too_dark": "The photo is too dark.",
    "too_bright": "The photo is too bright.",
    "blurry": "The photo is blurry.",
    "off_center": "The face is turned too far or not centered.",
    "face_too_small": "Move closer so the face fills more of the frame.",
    "clipped": "Part of the face is cut off.",
}


def cap_confidence(value: float, limit: float = CONFIDENCE_CAP) -> float:
    return round(min(limit, max(0.0, value)), 2)


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    x = rgb.astype(np.float32) / 255.0
    linear = np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
    matrix = np.array(
        [
            [0.4124564, 0.3575761, 0.1804375],
            [0.2126729, 0.7151522, 0.0721750],
            [0.0193339, 0.1191920, 0.9503041],
        ],
        dtype=np.float32,
    )
    xyz = linear @ matrix.T
    xyz[..., 0] /= 0.95047
    xyz[..., 2] /= 1.08883
    delta = 6.0 / 29.0

    def f(channel: np.ndarray) -> np.ndarray:
        return np.where(channel > delta**3, np.cbrt(channel), channel / (3 * delta**2) + 4.0 / 29.0)

    converted = f(xyz)
    lightness = 116.0 * converted[..., 1] - 16.0
    a_star = 500.0 * (converted[..., 0] - converted[..., 1])
    b_star = 200.0 * (converted[..., 1] - converted[..., 2])
    return np.stack([lightness, a_star, b_star], axis=-1)


def _pixels(landmarks: np.ndarray, indices: list[int], width: int, height: int) -> list[tuple[float, float]]:
    points = []
    for index in indices:
        if index >= len(landmarks):
            continue
        x = float(landmarks[index, 0]) * width
        y = float(landmarks[index, 1]) * height
        points.append((x, y))
    return points


def _mask(width: int, height: int, polygons: list[list[tuple[float, float]]], fill: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    for polygon in polygons:
        if len(polygon) >= 3:
            draw.polygon(polygon, fill=fill)
    return np.asarray(image) > 0


def _box(landmarks: np.ndarray, indices: list[int]) -> dict[str, float] | None:
    picked = [landmarks[i] for i in indices if i < len(landmarks)]
    if not picked:
        return None
    arr = np.asarray(picked, dtype=np.float32)
    x0 = float(np.clip(arr[:, 0].min(), 0, 1))
    y0 = float(np.clip(arr[:, 1].min(), 0, 1))
    x1 = float(np.clip(arr[:, 0].max(), 0, 1))
    y1 = float(np.clip(arr[:, 1].max(), 0, 1))
    return {"x": x0, "y": y0, "w": max(0.02, x1 - x0), "h": max(0.02, y1 - y0)}


def _laplacian_variance(gray: np.ndarray, mask: np.ndarray) -> float:
    if gray.shape[0] < 3 or gray.shape[1] < 3:
        return 0.0
    lap = (
        -4.0 * gray[1:-1, 1:-1]
        + gray[:-2, 1:-1]
        + gray[2:, 1:-1]
        + gray[1:-1, :-2]
        + gray[1:-1, 2:]
    )
    used = mask[1:-1, 1:-1]
    if int(used.sum()) < 20:
        return 0.0
    return float(lap[used].var())


def _mean(values: np.ndarray, mask: np.ndarray) -> float | None:
    if int(mask.sum()) < 10:
        return None
    return float(values[mask].mean())


def quality_reasons(rgb: np.ndarray, landmarks: np.ndarray) -> list[str]:
    height, width = rgb.shape[:2]
    reasons: list[str] = []
    if len(landmarks) < 468:
        return ["no_face"]

    xs = landmarks[:, 0]
    ys = landmarks[:, 1]
    box_w = float(xs.max() - xs.min())
    box_h = float(ys.max() - ys.min())
    if box_w * box_h < 0.20:
        reasons.append("face_too_small")
    if xs.min() < 0.02 or ys.min() < 0.02 or xs.max() > 0.98 or ys.max() > 0.98:
        reasons.append("clipped")

    center = (float(landmarks[234, 0]) + float(landmarks[454, 0])) / 2.0
    face_w = abs(float(landmarks[454, 0]) - float(landmarks[234, 0])) or 1.0
    yaw = (float(landmarks[1, 0]) - center) / face_w
    span = float(landmarks[152, 1]) - float(landmarks[10, 1])
    pitch = (float(landmarks[1, 1]) - float(landmarks[10, 1])) / span if span > 0.05 else 0.0
    if abs(yaw) > 0.22 or pitch < 0.35 or pitch > 0.75:
        reasons.append("off_center")

    oval = _pixels(landmarks, FACE_OVAL, width, height)
    mask = _mask(width, height, [oval], 255)
    gray = rgb.astype(np.float32).mean(axis=2)
    lightness = _mean(gray, mask)
    if lightness is None:
        reasons.append("no_face")
    elif lightness < 50:
        reasons.append("too_dark")
    elif lightness > 220:
        reasons.append("too_bright")

    small = np.asarray(Image.fromarray(gray.astype(np.uint8)).resize((160, 160)))
    small_mask = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).resize((160, 160))) > 0
    if _laplacian_variance(small.astype(np.float32), small_mask) < 12:
        reasons.append("blurry")
    return reasons


def _finding(
    concern: str,
    severity: str,
    confidence: float,
    zone: str,
    box: dict[str, float] | None,
    explanation: str,
    escalate: bool = False,
) -> dict:
    return {
        "concern": concern,
        "severity": severity,
        "confidence": cap_confidence(confidence),
        "explanation": explanation,
        "escalate": escalate or severity == "severe",
        "region": {"zone": zone, "space": "image", "box": box},
    }


def _severity_from_high(value: float, mild: float, moderate: float, severe: float) -> str:
    if value >= severe:
        return "severe"
    if value >= moderate:
        return "moderate"
    if value >= mild:
        return "mild"
    return "none"


def measure(rgb: np.ndarray, landmarks: np.ndarray) -> dict:
    height, width = rgb.shape[:2]
    lab = srgb_to_lab(rgb)
    lightness = lab[..., 0]
    a_star = lab[..., 1]
    oval = _pixels(landmarks, FACE_OVAL, width, height)
    face = _mask(width, height, [oval], 255)
    eyes = _mask(
        width,
        height,
        [
            _pixels(landmarks, LEFT_EYE, width, height),
            _pixels(landmarks, RIGHT_EYE, width, height),
            _pixels(landmarks, OUTER_LIPS, width, height),
        ],
        255,
    )
    skin = face & ~eyes

    def patch(indices: list[int], pad: float = 0.03) -> np.ndarray:
        box = _box(landmarks, indices)
        if box is None:
            return np.zeros_like(skin)
        x0 = max(0, int((box["x"] - pad) * width))
        y0 = max(0, int((box["y"] - pad) * height))
        x1 = min(width, int((box["x"] + box["w"] + pad) * width))
        y1 = min(height, int((box["y"] + box["h"] + pad) * height))
        mask = np.zeros_like(skin)
        mask[y0:y1, x0:x1] = True
        return mask & skin

    left_cheek = patch([50, 101, 118, 205])
    right_cheek = patch([280, 330, 347, 425])
    cheeks = left_cheek | right_cheek
    tzone = patch([10, 67, 109, 338, 297, 1, 4, 5], pad=0.04)
    under_eyes = patch([111, 117, 118, 145, 340, 346, 347, 374])

    cheek_a = _mean(a_star, cheeks)
    redness_value = cheek_a if cheek_a is not None else 0.0
    redness = _severity_from_high(redness_value, 18, 24, 32)

    c_light = _mean(lightness, cheeks)
    t_highlight = None
    c_highlight = None
    if tzone.any():
        t_highlight = float((lightness[tzone] > 78).mean())
    if cheeks.any():
        c_highlight = float((lightness[cheeks] > 78).mean())
    t_highlight = 0.0 if t_highlight is None else t_highlight
    c_highlight = 0.0 if c_highlight is None else c_highlight
    shine_gap = t_highlight - c_highlight
    if t_highlight > 0.18 and shine_gap > 0.08:
        skin_type = "oily"
        skin_conf = 0.35 + shine_gap
    elif t_highlight < 0.04 and c_highlight < 0.04 and (c_light or 70) < 58:
        skin_type = "dry"
        skin_conf = 0.34
    elif shine_gap > 0.05:
        skin_type = "combination"
        skin_conf = 0.36
    else:
        skin_type = "normal"
        skin_conf = 0.32

    gray = rgb.astype(np.float32).mean(axis=2)
    texture_var = _laplacian_variance(gray, cheeks if cheeks.any() else skin)
    texture = _severity_from_high(texture_var, 80, 160, 10_000)

    under = _mean(lightness, under_eyes)
    cheek_l = c_light if c_light is not None else under
    dark_gap = 0.0 if under is None or cheek_l is None else cheek_l - under
    dark = _severity_from_high(dark_gap, 8, 15, 10_000)

    spot_fraction = 0.0
    if int(skin.sum()) > 30:
        local = _box_mean(lightness, 9)
        spot_fraction = float(((lightness + 16 < local) & skin).mean())
    spots = _severity_from_high(spot_fraction, 0.02, 0.06, 1.0)

    findings = [
        _finding(
            "acne",
            "none",
            0.2,
            "face",
            _box(landmarks, FACE_OVAL),
            "This baseline does not detect acne. Red marks, if any, are reported only as redness.",
        ),
        _finding(
            "blackheads_pores",
            "mild" if texture == "moderate" else "none",
            0.3,
            "cheeks",
            _box(landmarks, [50, 280, 101, 330]),
            "High-frequency texture can look like pores. It is also caused by noise, hair, and compression.",
        ),
        _finding(
            "pigmentation",
            spots,
            0.28 + spot_fraction,
            "face",
            _box(landmarks, FACE_OVAL),
            "Small darker patches relative to the nearby skin. This is not a check for skin cancer.",
            escalate=spots == "severe",
        ),
        _finding(
            "redness",
            redness,
            0.3 + max(0.0, redness_value - 12) / 40,
            "cheeks",
            _box(landmarks, [50, 280, 118, 347]),
            "Cheek redness is estimated from color, not from a diagnosis. Lighting changes this number.",
            escalate=redness == "severe",
        ),
        _finding(
            "dark_circles",
            dark,
            0.3 + max(0.0, dark_gap) / 40,
            "under_eyes",
            _box(landmarks, [111, 340, 145, 374]),
            "The skin under the eyes is darker than the cheeks in this photo. Shadow and lighting can cause the same look.",
        ),
        _finding(
            "texture",
            texture if texture != "severe" else "moderate",
            0.32,
            "cheeks",
            _box(landmarks, [50, 280]),
            "Texture is estimated from edge energy on the cheeks. It is not a count of lines or pores.",
        ),
        _finding(
            "fine_lines",
            "mild" if texture_var > 140 else "none",
            0.25,
            "cheeks",
            _box(landmarks, [50, 280]),
            "Fine lines are not separated from other texture by this baseline.",
        ),
        _finding(
            "dehydration",
            "mild" if (c_light or 70) < 55 and texture != "none" else "none",
            0.22,
            "cheeks",
            _box(landmarks, [50, 280]),
            "Dehydration is not directly visible. This is a weak guess from dullness and texture, not a measurement.",
        ),
    ]
    visible = [item["concern"].replace("_", " ") for item in findings if item["severity"] != "none"]
    if visible:
        summary = (
            "Baseline visual estimate only. The photo suggests attention around "
            + ", ".join(visible)
            + ". This is not a measurement and not a diagnosis."
        )
    else:
        summary = (
            "Baseline visual estimate only. Nothing in this photo crossed the rough visual thresholds. "
            "That is not a clean bill of health."
        )
    return {
        "skin_type": skin_type,
        "skin_type_confidence": cap_confidence(skin_conf),
        "findings": findings,
        "summary": summary,
    }


def _box_mean(values: np.ndarray, radius: int) -> np.ndarray:
    padded = np.pad(values, radius, mode="edge")
    integral = np.pad(padded, ((1, 0), (1, 0)), mode="constant").cumsum(0).cumsum(1)
    height, width = values.shape
    y0 = np.arange(height)
    x0 = np.arange(width)
    y1 = y0 + 2 * radius + 1
    x1 = x0 + 2 * radius + 1
    total = (
        integral[y1[:, None], x1[None, :]]
        - integral[y0[:, None], x1[None, :]]
        - integral[y1[:, None], x0[None, :]]
        + integral[y0[:, None], x0[None, :]]
    )
    return total / float((2 * radius + 1) ** 2)


def rejection_summary(reasons: list[str]) -> str:
    text = " ".join(REASON_TEXT.get(reason, reason) for reason in reasons)
    return f"{text} No scores were produced. Informational only, not a medical diagnosis."


def analyze(rgb: np.ndarray, faces: list[np.ndarray]) -> dict:
    if len(faces) == 0:
        reasons = ["no_face"]
    elif len(faces) > 1:
        reasons = ["multiple_faces"]
    else:
        reasons = quality_reasons(rgb, faces[0])
    if reasons:
        return {
            "status": "rejected_quality",
            "modelVersion": MODEL_VERSION,
            "quality": {"accepted": False, "reasons": reasons},
            "summary": rejection_summary(reasons),
            "findings": [],
            "disclaimer": DISCLAIMER,
        }
    measured = measure(rgb, faces[0])
    escalate = any(item["escalate"] for item in measured["findings"])
    summary = measured["summary"]
    if escalate:
        summary += " If the skin is painful, spreading, or worries you, see a dermatologist. This app cannot assess skin cancer."
    return {
        "status": "succeeded",
        "modelVersion": MODEL_VERSION,
        "quality": {"accepted": True, "reasons": []},
        "skinType": measured["skin_type"],
        "skinTypeConfidence": measured["skin_type_confidence"],
        "findings": measured["findings"],
        "summary": summary,
        "escalation": (
            "See a dermatologist if this worries you. This app cannot assess skin cancer."
            if escalate
            else None
        ),
        "disclaimer": DISCLAIMER,
    }
