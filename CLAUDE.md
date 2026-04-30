<!--
CLAUDE.md — Operating manual for code-running agents (Cursor / Claude Code)
working in this repo. Web Claude has its own Project Instructions — this file
is specifically for terminal-side agents.
-->

# HZ-EV Brain · 智枢 ZHISHU — Agent Operating Manual

You are a code-running agent (Cursor / Claude Code) operating inside this
repo's local checkout. You can run shell commands, edit files, run tests, and
push to GitHub. This file tells you the **operational constraints** that
ambient context can't infer.

For project mission, architecture, and design system, see `README.md` (CN) or
`README.en.md` (EN). This file covers HOW to work, not WHAT to build.

---

## Repository identity

- **GitHub remote**: `git@github.com:lucifer-holly/hangzhou-ev-brain.git`
- **Local checkout path**: `/Users/holly/Desktop/EEE 532/hz-ev-brain` (note
  the SPACE in `EEE 532`; always quote paths in shell commands)
- **Default branch**: `main`
- **Status**: Public, v1.0.0 released, CI green, ~68 commits on main

---

## Identity & attribution (critical)

Every commit you create MUST be authored by:

```
Holly <63133305+lucifer-holly@users.noreply.github.com>
```

This is already set in `--global` git config. Verify before any commit:

```bash
git config user.name   # Expected: Holly
git config user.email  # Expected: 63133305+lucifer-holly@users.noreply.github.com
```

If either is wrong: **STOP and report**. Do not proceed.

### Forbidden in commit messages

- ❌ `Co-Authored-By: Claude <anything>`
- ❌ `Co-Authored-By: Cursor <anything>`
- ❌ `🤖 Generated with Claude Code`
- ❌ Any agent signature, trailer, or "Made with X" line

If your tooling auto-adds these (Cursor IDE Composer often does), you must
strip them before committing. The user has been burned by this; it pollutes
the GitHub Contributors panel.

---

## Git workflow rules

### Normal commits
- One coherent commit per task. Use Conventional Commits prefix:
  `feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `test:`, `ci:`
- Commit message: 1 short title line + blank line + body if needed
- Always quote the working directory in commands:
  `cd "/Users/holly/Desktop/EEE 532/hz-ev-brain"`

### Force pushes
- Only when rewriting history is necessary (e.g., stripping accidentally-leaked
  secrets or trailers)
- Always create a local backup tag first:
  `git tag local-backup-pre-<reason>`
- Use `--force-with-lease`, not `--force`
- Tell the user explicitly when you've force-pushed

### What's gitignored (do not stage these)
- `.env` (contains `VITE_AMAP_KEY` — secret, must never reach GitHub)
- `.DS_Store` (macOS junk)
- `output/`, `video/`, `.playwright-cli/` (local work-in-progress / artifacts)
- `node_modules/`, `__pycache__/`, `.venv/`
- `*.db`, `*.sqlite`, `*.log`
- `AGENTS.md` (symlink to this file)

If you see these in `git status` after running a task, something is wrong.
Stop and report.

---

## Pre-flight pattern (run before every multi-step task)

```bash
cd "/Users/holly/Desktop/EEE 532/hz-ev-brain"

pwd
git rev-parse --is-inside-work-tree
git branch --show-current   # Expected: main
git status --short          # Expected: clean (or only files relevant to the task)
git remote -v               # Expected: origin → ...hangzhou-ev-brain.git
git config user.email       # Expected: 63133305+lucifer-holly@users.noreply.github.com
```

If any check unexpected: **HALT and report**. Don't auto-fix.

---

## Code conventions

### Python (backend, AI, firmware)
- `black` + `ruff` (config in `pyproject.toml` — don't change)
- Type hints required on all public functions
- Docstrings on all public functions
- Comments should explain non-obvious intent / trade-offs only — do not narrate
  what the code does

### TypeScript (frontend)
- `strict: true` mode, ESLint + Prettier
- Design tokens centralized in `frontend/src/design-tokens/` —
  don't inline CSS variables anywhere else

### YAML (contracts)
- API schema changes go in `contracts/openapi.yaml` FIRST,
  then ripple to backend code, then frontend consumers

---

## Tech stack lock (don't suggest replacements)

| Layer | Locked to |
|---|---|
| Backend | FastAPI + SQLite + Mosquitto |
| AI | PyTorch + xgboost + shap + Ultralytics YOLO |
| Edge | ESP32-S3 (Wokwi) + TFLite Micro |
| Frontend | React + TypeScript + Vite + Tailwind + shadcn/ui + ECharts + AMap |
| Contracts | OpenAPI + AsyncAPI + JSON Schema |

Forbidden: ThingsBoard, TimescaleDB, Redis, Nginx, complex auth, HTTPS proxies,
Kafka, alternative UI libraries, alternative AI frameworks.

---

## Repository structure (high-level — see README for details)

```
hangzhou-ev-brain/
├── README.md          # default-rendered Chinese version
├── README.en.md       # English version
├── docs/              # 5 markdown design docs + images/screenshots/
├── contracts/         # OpenAPI / AsyncAPI / 4 operator JSON schemas
├── backend/
│   ├── api/           # FastAPI app
│   ├── synth/         # 100-pile × 30-day data generator
│   ├── adapters/      # 4 mocked operator integrations
│   ├── ai/            # LSTM, XGBoost+SHAP, Autoencoder, YOLOv8
│   └── mqtt/
├── frontend/
│   └── src/
│       ├── design-tokens/
│       ├── components/{ui,ioc,map,charts}
│       └── pages/{city-console,operator,driver}
├── firmware/pile-simulator/  # ESP32 Wokwi project + TFLite Micro
└── scripts/                  # one-shot shell scripts
```

---

## Done already (don't redo)

- v1.0.0 released with annotated tag and GitHub Release page
- 6 production screenshots in `docs/images/screenshots/01..06-*.png`
- Architecture diagram: `docs/images/architecture.png` (light SaaS theme,
  rasterized from `architecture.svg`)
- README in both languages with cross-link header
- 16 GitHub topics + bilingual Description configured
- Pinned to user's GitHub profile
- All git authors normalized to noreply email
- All `Co-Authored-By: Claude` trailers stripped from history
- All local backup tags cleaned and reflog gc'd
- CI green: `Backend · ruff + pytest`, `Frontend · pnpm lint + build`,
  `Contracts · YAML + JSON schema sanity`

---

## Active work (where help is welcome)

- **Demo video**: recording + voice-over script
  (output to `video/` — gitignored)
- **VPS deployment**: full-stack public demo site

## Deferred (don't start without user approval)

- Vercel deployment with mock data fallback (alternative to VPS, on ice)
- GitHub Actions Node 24 upgrade (issue exists, deadline 2026-09)

---

## When you're unsure

Halt and ask. The user prefers explicit confirmation over silent assumptions,
especially for:
- Anything that touches git history (rewrite / force-push / amend)
- Anything that adds dependencies (npm install, pip install)
- Anything that mutates `.env` or other secret-bearing files
- Anything that creates new top-level directories or renames files

---

## When you make a mistake

Be transparent. The user values disclosure of deviations from the prompt over
silent "I figured it out" results. Pattern that worked before:

> "I deviated from your prompt at step X because Y. The deviation is Z.
> This does/doesn't violate any hard prohibition. Confirm proceed?"

This is exactly how the previous successful rewrites were handled. Stick to
this pattern.
