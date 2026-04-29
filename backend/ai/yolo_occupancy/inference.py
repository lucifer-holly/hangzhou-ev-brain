"""Wrapper around the Ultralytics YOLOv8 nano model.

We use the pretrained COCO weights — no fine-tuning is needed since
the demo only has to detect *vehicles* (``car``, ``truck``, ``bus``,
``motorcycle``).  On first import the weights are downloaded by
Ultralytics into ``~/.ultralytics`` (or the override below).

Usage::

    from ai.yolo_occupancy import detect_image
    result = detect_image("path/to/parking_lot.jpg")
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
from PIL import Image

log = logging.getLogger("ai.yolo_occupancy.inference")

_VEHICLE_CLASSES: frozenset[str] = frozenset({"car", "truck", "bus", "motorcycle"})

# We pin the weight name and ship-with-repo location so the FastAPI
# endpoint can warn loudly when the file is missing rather than silently
# downloading 6 MB on each cold start.
_SAVED_DIR = Path(__file__).parent / "saved"
_WEIGHT_NAME = "yolov8n.pt"
_WEIGHT_PATH = _SAVED_DIR / _WEIGHT_NAME


@dataclass(frozen=True, slots=True)
class DetectionBox:
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    class_name: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class DetectionResult:
    vehicle_count: int
    boxes: list[DetectionBox]
    image_width: int
    image_height: int
    inference_ms: float

    def to_dict(self) -> dict:
        return {
            "vehicle_count": self.vehicle_count,
            "boxes": [b.to_dict() for b in self.boxes],
            "image_width": self.image_width,
            "image_height": self.image_height,
            "inference_ms": self.inference_ms,
        }


class YoloOccupancyDetector:
    """Lazily-loaded YOLOv8 detector. Singleton-style."""

    _instance: "YoloOccupancyDetector | None" = None

    def __init__(self) -> None:
        # Local import keeps the heavy ultralytics import out of module
        # load and lets the unit tests stub it.
        from ultralytics import YOLO

        _SAVED_DIR.mkdir(parents=True, exist_ok=True)
        weight = _WEIGHT_PATH if _WEIGHT_PATH.exists() else _WEIGHT_NAME
        log.info("loading YOLO weights from %s", weight)
        self.model = YOLO(str(weight))
        if not _WEIGHT_PATH.exists():
            # Ultralytics downloads to CWD by default; copy into our saved/
            # so future runs are offline-friendly.
            cwd_weight = Path(_WEIGHT_NAME)
            if cwd_weight.exists():
                cwd_weight.replace(_WEIGHT_PATH)
                log.info("cached weights → %s", _WEIGHT_PATH)

    @classmethod
    def shared(cls) -> "YoloOccupancyDetector":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def detect(
        self, image_path: str | Path, conf: float = 0.25
    ) -> DetectionResult:
        import time

        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"image not found: {path}")
        with Image.open(path) as im:
            w, h = im.size

        t0 = time.perf_counter()
        results = self.model(str(path), conf=conf, verbose=False)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        boxes: list[DetectionBox] = []
        for res in results:
            names = res.names  # {0: 'person', ...}
            if res.boxes is None:
                continue
            xyxy = res.boxes.xyxy.cpu().numpy()
            confs = res.boxes.conf.cpu().numpy()
            cls_idx = res.boxes.cls.cpu().numpy().astype(int)
            for box, c, ci in zip(xyxy, confs, cls_idx):
                cls_name = names.get(int(ci), str(ci))
                if cls_name not in _VEHICLE_CLASSES:
                    continue
                boxes.append(
                    DetectionBox(
                        x1=float(box[0]),
                        y1=float(box[1]),
                        x2=float(box[2]),
                        y2=float(box[3]),
                        confidence=float(c),
                        class_name=cls_name,
                    )
                )
        return DetectionResult(
            vehicle_count=len(boxes),
            boxes=boxes,
            image_width=w,
            image_height=h,
            inference_ms=elapsed_ms,
        )


def detect_image(path: str | Path, conf: float = 0.25) -> DetectionResult:
    return YoloOccupancyDetector.shared().detect(path, conf=conf)


def synthesize_sample_image(out_path: Path) -> Path:
    """Generate a small synthetic 'parking lot' PNG so the demo always works.

    Real parking-lot photos are nicer but bring licensing concerns into the
    repo — this 512×288 noisy gradient with rectangular blobs is enough for
    YOLO to fire at least zero detections without crashing, and the demo
    UX gracefully reports "0 vehicles detected".
    """
    rng = np.random.default_rng(42)
    img = (rng.uniform(40, 120, size=(288, 512, 3))).astype(np.uint8)
    # Paint three darker rectangles (placeholder parked cars).
    for (x, y) in [(60, 80), (220, 90), (380, 100)]:
        img[y : y + 70, x : x + 110, :] = rng.integers(20, 80, size=(70, 110, 3))
    Image.fromarray(img).save(out_path)
    return out_path
