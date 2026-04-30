# Contributing to HZ-EV Brain · 智枢

Thanks for considering a contribution! HZ-EV Brain is primarily a
personal portfolio project, but the codebase is open-source MIT
and we welcome **bug fixes, doc clarifications, and small extensions**
that keep the project's scope intact.

If you're considering a larger change (a new governance function, a
new AI model, a major refactor), please open an Issue first so we can
agree on the design before you sink time into it.

---

## Code style

The project pins the following toolchain — please follow it instead of
introducing new tools:

### Python (`backend/`)

- Python ≥ 3.11
- **Format**: `ruff format` (Black-compatible). Line length 100.
- **Lint**: `ruff check` with the rules in `backend/pyproject.toml`.
- **Type hints**: required on all public functions; `mypy` is not
  currently enforced but new code should be `mypy`-clean.
- **Docstrings**: Google-style on public functions and classes.
- **Tests**: `pytest` + `pytest-asyncio` under `backend/tests/`.
  `asyncio_mode = "auto"` is set in `pyproject.toml`, so you can `async
  def` test functions without decorators.

```bash
cd backend
pip install -e ".[dev]"
ruff check .
ruff format .
pytest
```

### TypeScript (`frontend/`)

- TypeScript 5 strict mode. The `tsconfig.json` is non-negotiable.
- **Format**: Prettier with `prettier-plugin-tailwindcss` (auto-sorts
  Tailwind class lists).
- **Lint**: ESLint with `@typescript-eslint` and the React Hooks
  + Refresh plugins.
- **No new UI library**. The frontend pins `shadcn/ui + Tailwind` —
  if a primitive is missing, build it under `src/components/ui/`.
- **Design tokens are the source of truth**. Don't hard-code colors
  or font sizes; reach for `frontend/src/design-tokens/` (mirrored as
  Tailwind utilities) instead.

```bash
cd frontend
pnpm install
pnpm run codegen      # regenerate types from contracts/openapi.yaml
pnpm lint
pnpm format
pnpm build
```

### Embedded C++ (`firmware/pile-simulator/`)

- C++17.
- Format: `clang-format` with the project's `.clang-format` (Google
  base).
- Build: PlatformIO. CI runs `pio run`.
- Run on Wokwi via the VS Code extension — no real hardware needed.

### Contracts (`contracts/`)

- `openapi.yaml` is **auto-generated** from FastAPI's `/openapi.json`
  — do not hand-edit. After backend schema changes, regenerate with:

  ```bash
  curl -s http://localhost:8000/openapi.json | \
    python3 -c "import yaml,json,sys; \
                yaml.dump(json.load(sys.stdin), sys.stdout, allow_unicode=True, sort_keys=False)" \
    > contracts/openapi.yaml
  ```

- `asyncapi.yaml` is hand-written; edit it before adding new MQTT
  topics in code.
- Operator schemas (`operators/*.schema.json`) are the contract for
  data shape. Adding a new operator means adding a new schema file
  matching that vendor's real naming style.

---

## Issues & Pull Requests

### Reporting issues

Good bug reports include:

- The exact command(s) you ran (`docker-compose up`, `pnpm dev`, etc.)
- Backend logs (`docker-compose logs backend`) and / or browser
  console output if the bug is in the frontend.
- A minimal reproduction — ideally a fresh clone + the smallest set
  of steps that triggers the bug.

For documentation issues, just say which page is wrong and quote the
exact paragraph; that's enough.

### Pull request flow

1. **Fork** the repo and **create a branch** off `main`. Branch names
   like `fix/site-selection-shap-units` or `docs/architecture-typo`
   are appreciated.
2. **One concern per PR.** A PR that fixes a bug *and* adds a feature
   *and* refactors three unrelated files will be asked to split.
3. **Run the same checks CI runs** before pushing:

   ```bash
   # backend
   cd backend && ruff check . && pytest
   # frontend
   cd ../frontend && pnpm lint && pnpm build
   ```

4. **Commit messages** follow the existing convention in the repo:

   ```
   <Area>: <one-line summary>
   <blank>
   <body — what + why, not how. wrap at 72 cols.>
   ```

   Examples from the project history:
   - `Spawn 5/D: mode switcher (realtime/history/predict) + batched LSTM forecast`
   - `Hotfix: Site Selection map now respects VITE_MAP_PROVIDER`
   - `docs: typo in architecture.md`

5. **Keep the diff focused.** If your branch grew accidental
   refactors, drop them into separate commits or a follow-up PR.

6. **Update docs.** A change to a contract goes into `contracts/`;
   a change to an AI model goes into `docs/ai-models.md`; a change
   to a design token goes into `docs/design-system.md`.

### Review

A maintainer will respond within a few days for small / medium PRs.
Larger structural changes may take longer because they get reviewed
against the project's spec (`docs/spec.md`) — sometimes that uncovers
a design discussion that needs to happen first.

---

## Out of scope

To keep the project focused, the following are explicitly **not**
accepted as PRs (see [`docs/spec.md` §13](./docs/spec.md)):

- Authentication / RBAC / HTTPS
- Production-grade logging / observability / monitoring
- Database migrations / multi-tenancy
- ThingsBoard / Kafka / Redis / TimescaleDB integration (see the
  decision log in [`CLAUDE.md`](./CLAUDE.md))
- New AI frameworks (the stack is locked at PyTorch + xgboost +
  Ultralytics)
- New UI libraries (locked at shadcn/ui + Tailwind)

If you're convinced one of these belongs in the project, open an Issue
arguing the case before writing the code. Most have been considered
and ruled out for good reasons; we're happy to discuss but the bar is
high.

---

## License

By contributing, you agree that your work will be released under the
project's [MIT License](./LICENSE).
