# `yolo_occupancy/` — YOLOv8 vehicle detection

Wraps the **pretrained** Ultralytics `yolov8n.pt` (≈ 3 M params, COCO
classes) and filters detections to vehicle classes (`car`, `truck`,
`bus`, `motorcycle`).  No training is performed here — the demo
streams a parking-lot image to the FastAPI endpoint and renders the
bounding boxes.

## How the weights are obtained

On the first detection call, Ultralytics downloads `yolov8n.pt` (~6 MB)
into the current working directory.  Our wrapper then moves the file
into [`saved/yolov8n.pt`](./saved/) so subsequent runs are offline.

`saved/yolov8n.pt` is git-ignored — see the project root `.gitignore`.

## Sample images

* [`sample_images/sample_bus.jpg`](./sample_images/sample_bus.jpg) —
  copied from the Ultralytics package (`ultralytics/assets/bus.jpg`),
  used as a deterministic demo image that produces a known detection
  (`bus` @ 0.87).
* [`sample_images/sample_parking_lot.jpg`](./sample_images/sample_parking_lot.jpg) —
  synthetic top-down "parking lot" generated procedurally so the
  endpoint can be exercised offline without bundling third-party
  photos.  Detection count on the synthetic image is typically zero —
  the goal is just to prove the endpoint plumbing works end-to-end.

You can drop your own JPGs into `sample_images/` and pass them via
`-F image=@…` to the endpoint.

## API

```bash
curl -X POST http://localhost:8000/api/ai/yolo/detect \
  -F "image=@backend/ai/yolo_occupancy/sample_images/sample_bus.jpg"
```

Response:

```json
{
  "vehicle_count": 1,
  "boxes": [{"x1": 14.7, "y1": 230.2, "x2": 802.0, "y2": 752.6,
             "confidence": 0.87, "class_name": "bus"}],
  "image_width": 810,
  "image_height": 1080,
  "inference_ms": 112.3
}
```

## Latency

~50–150 ms per 512 × 288 image on Apple Silicon CPU (single-threaded
because the FastAPI app caps OpenMP threads — see
`api/main.py`).
