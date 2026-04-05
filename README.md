# Symbol Games

Research MVP for a multiplayer orthography experiment on emergent symbolic depth.

## Structure

- `backend/` FastAPI API, WebSocket game loop, persistence models, exports, and pure scheduling/stimulus tests.
- `frontend/` React + TypeScript + Vite participant app and admin dashboard.
- `assets/` generated primitive SVGs, referent SVGs, audio stimuli, and the study manifest.
- `scripts/` local generation helpers.

## Local Setup

1. Generate assets:

```bash
python3 scripts/generate_assets.py
```

2. Install backend dependencies:

```bash
python3 -m pip install -e "backend[dev]"
```

3. Install frontend dependencies:

```bash
cd frontend
npm install
```

4. Run the backend:

```bash
uvicorn app.main:app --reload --app-dir backend
```

5. Run the frontend:

```bash
cd frontend
npm run dev
```

The Vite dev server proxies `/api`, `/ws`, and `/study-assets` to the FastAPI app.

## Testing

Pure Python logic can be validated without installing FastAPI:

```bash
python3 -m py_compile $(find backend/app scripts -name '*.py' | sort)
```

Once dependencies are installed:

```bash
pytest backend/app/tests
cd frontend && npm test
```

## Deployment

- `Dockerfile` builds the frontend and serves it from the FastAPI container.
- `docker-compose.yml` provides local Postgres plus the app service.
- `fly.toml` is a starter config for single-instance Fly.io deployment.
