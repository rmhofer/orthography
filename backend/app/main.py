from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.deps import get_db
from app.api.routes_admin import router as admin_router
from app.api.routes_participants import router as participants_router
from app.core.config import get_settings
from app.db.repository import Repository
from app.db.session import SessionLocal
from app.services.runtime import get_session_manager


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    db = SessionLocal()
    try:
        Repository(db).create_all()
        yield
    finally:
        db.close()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
manager = get_session_manager()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(participants_router)
app.include_router(admin_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.websocket("/ws/participant/{token}")
async def participant_ws(websocket: WebSocket, token: str) -> None:
    db = SessionLocal()
    try:
        participant = Repository(db).get_participant_by_token(token)
        if participant is None:
            await websocket.accept()
            await websocket.send_json({"event": "error", "payload": {"detail": "Unknown participant token."}})
            await websocket.close(code=4404)
            return
        await manager.connect(db, participant, websocket)
        while True:
            message = await websocket.receive_json()
            db.expire_all()
            participant = Repository(db).get_participant_by_token(token)
            if participant is None:
                raise HTTPException(status_code=404, detail="Unknown participant token.")
            await manager.handle_event(db, participant, message)
    except WebSocketDisconnect:
        await manager.disconnect(token)
    finally:
        db.close()


assets_path = settings.assets_dir
if assets_path.exists():
    app.mount("/study-assets", StaticFiles(directory=assets_path), name="study-assets")


frontend_dist = settings.frontend_dist_dir
if frontend_dist.exists():
    app.mount("/static", StaticFiles(directory=frontend_dist / "assets"), name="frontend-static")

    @app.get("/{path_name:path}")
    async def serve_frontend(path_name: str) -> FileResponse:
        requested = frontend_dist / path_name
        if path_name and requested.exists() and requested.is_file():
            return FileResponse(requested)
        index_path = frontend_dist / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Frontend build not found.")
