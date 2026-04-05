from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.core.config import get_settings
from app.core.exporters import trials_to_csv
from app.core.security import issue_admin_token
from app.db.repository import Repository
from app.schemas.contracts import AdminConfigUpdateRequest, AdminLoginRequest, AdminLoginResponse, AdminPairRequest
from app.services.runtime import get_session_manager


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/login", response_model=AdminLoginResponse)
def admin_login(request: AdminLoginRequest, settings=Depends(get_settings)) -> AdminLoginResponse:
    if request.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Incorrect password.")
    return AdminLoginResponse(accessToken=issue_admin_token(settings.admin_secret))


@router.get("/config")
def get_config(_: dict = Depends(require_admin), db: Session = Depends(get_db), settings=Depends(get_settings)) -> dict:
    stored = Repository(db).get_admin_config()
    return {**settings.public_study_config(), **stored}


@router.put("/config")
def update_config(
    request: AdminConfigUpdateRequest,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
    settings=Depends(get_settings),
) -> dict:
    current = {**settings.public_study_config(), **Repository(db).get_admin_config()}
    updates = request.model_dump(exclude_none=True)
    current.update(updates)
    return Repository(db).upsert_admin_config(current)


@router.get("/lobby")
def get_lobby(_: dict = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    participants = Repository(db).list_waiting_participants()
    return {
        "participants": [
            {
                "participantId": participant.public_id,
                "token": participant.token,
                "joinedAt": participant.waiting_joined_at.isoformat() if participant.waiting_joined_at else None,
            }
            for participant in participants
        ]
    }


@router.get("/sessions")
def get_sessions(_: dict = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    sessions = Repository(db).list_active_sessions()
    return {
        "sessions": [
            {
                "sessionId": session.public_id,
                "dyadId": session.dyad.public_id if session.dyad else None,
                "state": session.state,
                "trialNumber": session.current_trial_number,
                "score": session.cumulative_score,
                "condition": session.dyad.condition if session.dyad else None,
            }
            for session in sessions
        ]
    }


@router.post("/pair")
def manual_pair(request: AdminPairRequest, _: dict = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    repository = Repository(db)
    participant_a = repository.get_participant_by_token(request.participantAToken)
    participant_b = repository.get_participant_by_token(request.participantBToken)
    if participant_a is None or participant_b is None:
        raise HTTPException(status_code=404, detail="Participant token not found.")
    return get_session_manager().pair_participants(db, participant_a, participant_b, request.condition)


@router.post("/sessions/{session_id}/pause")
def pause_session(session_id: str, _: dict = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    get_session_manager().pause_session(db, session_id)
    return {"sessionId": session_id, "paused": True}


@router.post("/sessions/{session_id}/end")
def end_session(session_id: str, _: dict = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    get_session_manager().end_session(db, session_id)
    return {"sessionId": session_id, "ended": True}


@router.get("/exports")
def export_data(format: str = "json", _: dict = Depends(require_admin), db: Session = Depends(get_db)) -> Response:
    dyads = Repository(db).export_dyads()
    if format == "csv":
        trials = [trial for dyad in dyads for trial in dyad["trials"]]
        csv_output = trials_to_csv(trials)
        return Response(content=csv_output, media_type="text/csv")
    return Response(content=json.dumps(dyads, indent=2), media_type="application/json")
