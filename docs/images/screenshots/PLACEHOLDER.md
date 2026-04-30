# Screenshots — placeholder folder

Spawn 10 (Demo Video & Screenshots) replaces the six PNG files referenced
from the root README:

| File | Page | Theme |
|---|---|---|
| `01-ioc-home.png` | City Console — IOC big-screen home | dark |
| `02-site-selection.png` | Site Selection (XGBoost + SHAP) | light |
| `03-grid-coordination.png` | Grid Coordination (LP) | light |
| `04-compliance.png` | Operator Compliance | light |
| `05-emergency.png` | Emergency Response | light |
| `06-pile-edge.png` | Single pile detail + Edge AI link | light |

## Capture conventions

- Resolution: **1600 × 900** (16:9, retina-friendly when downsampled in
  README cards).
- Crop: Browser chrome **off**; capture only the application's main
  panel.
- File format: `.png`, ≤ 600 KB after `pngcrush`/`oxipng`.
- Naming: literal — keep the `NN-page-name.png` pattern so the README
  links keep working without edits.

## Capture workflow (suggested)

```bash
# 1. Bring the demo up.
docker-compose up -d
# 2. Use Playwright (already installed in this repo's .playwright-cli/ dir):
npx playwright-cli screenshot --full-page=false \
    --width 1600 --height 900 \
    http://localhost:5173/city \
    docs/images/screenshots/01-ioc-home.png
```

Or capture by hand using the macOS `Cmd-Shift-4` selection tool — that
also tends to look cleaner because Playwright's headless Chromium
doesn't load all our self-hosted fonts on first paint.
