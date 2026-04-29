"""YOLOv8 (Ultralytics, COCO-pretrained) parking-occupancy detection."""

from ai.yolo_occupancy.inference import YoloOccupancyDetector, detect_image

__all__ = ["YoloOccupancyDetector", "detect_image"]
