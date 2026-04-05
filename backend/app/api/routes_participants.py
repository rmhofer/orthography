from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import get_settings
from app.db.repository import Repository
from app.schemas.contracts import (
    AudioCheckRequest,
    BootstrapResponse,
    ConsentRequest,
    DebriefSubmissionRequest,
    ExposureEventRequest,
    LearningCompleteRequest,
    LobbyJoinRequest,
    ParticipantStartRequest,
    ParticipantStartResponse,
    QuizSubmissionRequest,
    StudyConfig,
)
from app.services.runtime import get_session_manager


router = APIRouter(prefix="/api/participants", tags=["participants"])


@router.post("/start", response_model=ParticipantStartResponse)
def start_participant(
    request: ParticipantStartRequest,
    db: Session = Depends(get_db),
) -> ParticipantStartResponse:
    repository = Repository(db)
    participant = repository.get_or_create_participant(request.token, request.recruitmentData)
    return ParticipantStartResponse(token=participant.token, participantId=participant.public_id, phase=participant.phase)


@router.get("/{token}/bootstrap", response_model=BootstrapResponse)
def bootstrap_participant(token: str, db: Session = Depends(get_db)) -> BootstrapResponse:
    participant = Repository(db).get_participant_by_token(token)
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown participant token.")
    manager = get_session_manager()
    payload = manager.bootstrap(db, participant)
    payload["studyConfig"] = StudyConfig(**payload["studyConfig"])
    return BootstrapResponse(**payload)


@router.post("/{token}/consent")
def record_consent(token: str, request: ConsentRequest, db: Session = Depends(get_db)) -> dict:
    repository = Repository(db)
    participant = repository.get_participant_by_token(token)
    if participant is None:
        raise HTTPException(status_code=404, detail="Unknown participant.")
    updated = get_session_manager().record_consent(db, participant, request.consented)
    return {"phase": updated.phase, "consented": updated.consented}


@router.post("/{token}/audio-check")
def record_audio_check(token: str, request: AudioCheckRequest, db: Session = Depends(get_db)) -> dict:
    participant = Repository(db).get_participant_by_token(token)
    if participant is None:
        raise HTTPException(status_code=404, detail="Unknown participant.")
    updated = get_session_manager().record_audio_check(db, participant, request.passed)
    return {"phase": updated.phase, "audioChecked": updated.audio_checked}


@router.post("/{token}/learning/exposure")
def record_exposure(token: str, request: ExposureEventRequest, db: Session = Depends(get_db)) -> dict:
    participant = Repository(db).get_participant_by_token(token)
    if participant is None:
        raise HTTPException(status_code=404, detail="Unknown participant.")
    updated = get_session_manager().record_exposure(db, participant, request.referentId)
    return {"learningState": updated.learning_state}


@router.post("/{token}/learning/quiz")
def record_quiz(token: str, request: QuizSubmissionRequest, db: Session = Depends(get_db)) -> dict:
    participant = Repository(db).get_participant_by_token(token)
    if participant is None:
        raise HTTPException(status_code=404, detail="Unknown participant.")
    outcome = get_session_manager().record_quiz(db, participant, request.isCorrect)
    return outcome


@router.post("/{token}/learning/complete")
def complete_learning(token: str, request: LearningCompleteRequest, db: Session = Depends(get_db)) -> dict:
    participant = Repository(db).get_participant_by_token(token)
    if participant is None:
        raise HTTPException(status_code=404, detail="Unknown participant.")
    updated = get_session_manager().complete_learning(db, participant, request.practiceTrialsCompleted)
    return {"phase": updated.phase}


@router.post("/{token}/lobby/join")
def join_lobby(token: str, request: LobbyJoinRequest, db: Session = Depends(get_db)) -> dict:
    participant = Repository(db).get_participant_by_token(token)
    if participant is None:
        raise HTTPException(status_code=404, detail="Unknown participant.")
    if not request.ready:
        return {"participantPhase": participant.phase, "pairedSession": None}
    return get_session_manager().join_lobby(db, participant)


@router.post("/{token}/debrief")
def submit_debrief(token: str, request: DebriefSubmissionRequest, db: Session = Depends(get_db)) -> dict:
    repository = Repository(db)
    participant = repository.get_participant_by_token(token)
    if participant is None:
        raise HTTPException(status_code=404, detail="Unknown participant.")
    repository.save_debrief(participant, request.answers)
    refreshed = repository.get_participant_by_token(token)
    assert refreshed is not None
    return {"phase": refreshed.phase, "completionCode": refreshed.completion_code}
