"""MediaPipe face landmarks. The task file is Apache-2.0.

Pinned asset:
https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
Set FACE_LANDMARKER_MODEL to the local path. This module does not download it.
"""

from __future__ import annotations

import os
import threading

import numpy as np

_LOCK = threading.Lock()
_LANDMARKER = None


class ModelMissingError(FileNotFoundError):
    pass


def model_path() -> str:
    configured = os.environ.get("FACE_LANDMARKER_MODEL", "")
    if configured:
        return configured
    return os.path.join(os.path.dirname(__file__), "..", "models", "face_landmarker.task")


def detect_faces(rgb: np.ndarray) -> list[np.ndarray]:
    landmarker = _load()
    import mediapipe as mp

    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
    result = landmarker.detect(image)
    faces: list[np.ndarray] = []
    for face in result.face_landmarks:
        faces.append(np.array([(point.x, point.y) for point in face], dtype=np.float32))
    return faces


def _load():
    global _LANDMARKER
    with _LOCK:
        if _LANDMARKER is not None:
            return _LANDMARKER
        path = model_path()
        if not os.path.isfile(path):
            raise ModelMissingError(path)
        from mediapipe.tasks.python.core.base_options import BaseOptions
        from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions

        options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=path),
            num_faces=2,
            min_face_detection_confidence=0.5,
        )
        _LANDMARKER = FaceLandmarker.create_from_options(options)
        return _LANDMARKER
