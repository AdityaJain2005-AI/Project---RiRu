import math

import numpy as np

from app.face_analysis import (
    CONFIDENCE_CAP,
    FACE_OVAL,
    analyze,
    cap_confidence,
    quality_reasons,
    srgb_to_lab,
)


def test_red_has_higher_a_star_than_green() -> None:
    red = np.zeros((8, 8, 3), dtype=np.uint8)
    red[..., 0] = 255
    green = np.zeros((8, 8, 3), dtype=np.uint8)
    green[..., 1] = 255
    assert float(srgb_to_lab(red)[..., 1].mean()) > float(srgb_to_lab(green)[..., 1].mean())


def test_confidence_cap() -> None:
    assert cap_confidence(0.99) <= CONFIDENCE_CAP
    assert cap_confidence(-1) == 0


def test_missing_landmarks_are_no_face() -> None:
    image = np.full((32, 32, 3), 140, dtype=np.uint8)
    result = analyze(image, [])
    assert result["status"] == "rejected_quality"
    assert result["quality"]["reasons"] == ["no_face"]
    assert result["findings"] == []
    assert "Informational only, not a medical diagnosis." in result["summary"]


def test_short_landmark_list_is_no_face() -> None:
    image = np.full((32, 32, 3), 140, dtype=np.uint8)
    reasons = quality_reasons(image, np.zeros((10, 2), dtype=np.float32))
    assert reasons == ["no_face"]


def test_tiny_face_is_rejected() -> None:
    image = np.full((80, 80, 3), 150, dtype=np.uint8)
    points = np.full((478, 2), 0.45, dtype=np.float32)
    points[0] = (0.40, 0.40)
    points[2] = (0.50, 0.50)
    result = analyze(image, [points])
    assert result["status"] == "rejected_quality"
    assert "face_too_small" in result["quality"]["reasons"]
    assert result["findings"] == []


def _sharp_face() -> np.ndarray:
    image = np.full((240, 240, 3), (190, 150, 130), dtype=np.uint8)
    image[::3, :, :] = (150, 110, 95)
    image[:, ::5, :] = (210, 170, 145)
    return image


def _front_landmarks() -> np.ndarray:
    points = np.full((478, 2), 0.5, dtype=np.float32)
    count = len(FACE_OVAL)
    for index, landmark in enumerate(FACE_OVAL):
        angle = -math.pi / 2 + (2 * math.pi * index / count)
        points[landmark, 0] = 0.50 + 0.28 * math.cos(angle)
        points[landmark, 1] = 0.48 + 0.32 * math.sin(angle)
    placed = {
        10: (0.50, 0.18),
        152: (0.50, 0.80),
        234: (0.22, 0.48),
        454: (0.78, 0.48),
        1: (0.50, 0.50),
        50: (0.35, 0.55),
        101: (0.38, 0.48),
        118: (0.36, 0.62),
        205: (0.40, 0.58),
        280: (0.65, 0.55),
        330: (0.62, 0.48),
        347: (0.64, 0.62),
        425: (0.60, 0.58),
        67: (0.42, 0.28),
        109: (0.40, 0.24),
        338: (0.58, 0.28),
        297: (0.60, 0.24),
        4: (0.50, 0.58),
        5: (0.50, 0.62),
        111: (0.38, 0.42),
        117: (0.36, 0.44),
        145: (0.40, 0.46),
        340: (0.62, 0.42),
        346: (0.64, 0.44),
        374: (0.60, 0.46),
    }
    for landmark, xy in placed.items():
        points[landmark] = xy
    return points


def test_front_face_succeeds_without_claiming_acne() -> None:
    result = analyze(_sharp_face(), [_front_landmarks()])
    assert result["status"] == "succeeded"
    assert result["modelVersion"] == "baseline_cv_v1"
    assert result["skinTypeConfidence"] <= CONFIDENCE_CAP
    acne = next(item for item in result["findings"] if item["concern"] == "acne")
    assert acne["severity"] == "none"
    assert "does not detect acne" in acne["explanation"]
    for item in result["findings"]:
        assert item["confidence"] <= CONFIDENCE_CAP
        assert item["region"]["space"] == "image"
    assert result["disclaimer"] == "Informational only, not a medical diagnosis."
