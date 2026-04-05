from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime
import json
import random
import secrets
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.learning import LearningProgress
from app.core.schedule import build_schedule
from app.core.stimuli import build_manifest, build_referents, word_for_referent
from app.db.models import (
    AdminConfigModel,
    Base,
    CanvasEventModel,
    DebriefResponseModel,
    DyadModel,
    GameSessionModel,
    ListenerResponseModel,
    ParticipantModel,
    TrialRecordModel,
)


class Repository:
    def __init__(self, db: Session):
        self.db = db

    def create_all(self) -> None:
        Base.metadata.create_all(bind=self.db.get_bind())

    def get_admin_config(self) -> dict:
        config = self.db.get(AdminConfigModel, "study")
        if config is None:
            return {}
        return config.value

    def upsert_admin_config(self, value: dict) -> dict:
        config = self.db.get(AdminConfigModel, "study")
        if config is None:
            config = AdminConfigModel(key="study", value=value)
            self.db.add(config)
        else:
            config.value = value
        self.db.commit()
        self.db.refresh(config)
        return config.value

    def create_participant(self, metadata: dict | None = None) -> ParticipantModel:
        metadata = metadata or {}
        metadata.setdefault("assignedCondition", random.choice(["transparent", "opaque"]))
        participant = ParticipantModel(token=secrets.token_urlsafe(18), metadata_json=metadata, learning_state={})
        self.db.add(participant)
        self.db.commit()
        self.db.refresh(participant)
        return participant

    def get_participant_by_token(self, token: str) -> ParticipantModel | None:
        return self.db.scalar(select(ParticipantModel).where(ParticipantModel.token == token))

    def list_waiting_participants(self) -> list[ParticipantModel]:
        stmt = select(ParticipantModel).where(ParticipantModel.phase == "waiting").order_by(ParticipantModel.waiting_joined_at.asc())
        return list(self.db.scalars(stmt))

    def update_participant(self, participant: ParticipantModel) -> ParticipantModel:
        self.db.add(participant)
        self.db.commit()
        self.db.refresh(participant)
        return participant

    def queue_participant(self, participant: ParticipantModel) -> ParticipantModel:
        participant.phase = "waiting"
        participant.waiting_joined_at = datetime.now(UTC)
        self.db.add(participant)
        self.db.commit()
        self.db.refresh(participant)
        return participant

    def create_dyad(
        self,
        participant_a: ParticipantModel,
        participant_b: ParticipantModel,
        condition: Literal["transparent", "opaque"],
        config_snapshot: dict,
    ) -> tuple[DyadModel, GameSessionModel]:
        dyad = DyadModel(
            condition=condition,
            view_mode=config_snapshot.get("viewMode", "transmit"),
            config_snapshot=config_snapshot,
            participant_a_token=participant_a.token,
            participant_b_token=participant_b.token,
            status="paired",
            started_at=datetime.now(UTC),
        )
        self.db.add(dyad)
        self.db.flush()

        schedule = [trial.to_dict() for trial in build_schedule(dyad.public_id, condition, config_snapshot.get("totalTrials", 60))]
        session = GameSessionModel(dyad_id=dyad.id, schedule_json=schedule, state="ready")
        self.db.add(session)
        self.db.flush()

        participant_a.dyad_id = dyad.id
        participant_a.slot = "participant_a"
        participant_a.phase = "game"
        participant_b.dyad_id = dyad.id
        participant_b.slot = "participant_b"
        participant_b.phase = "game"
        self.db.add_all([participant_a, participant_b])
        self.db.commit()
        self.db.refresh(dyad)
        self.db.refresh(session)
        self.db.refresh(participant_a)
        self.db.refresh(participant_b)
        return dyad, session

    def get_session_for_participant(self, participant: ParticipantModel) -> tuple[DyadModel, GameSessionModel] | None:
        if participant.dyad_id is None:
            return None
        dyad = self.db.get(DyadModel, participant.dyad_id)
        if dyad is None or dyad.session is None:
            return None
        return dyad, dyad.session

    def get_session_by_public_id(self, public_id: str) -> GameSessionModel | None:
        return self.db.scalar(select(GameSessionModel).where(GameSessionModel.public_id == public_id))

    def list_active_sessions(self) -> list[GameSessionModel]:
        stmt = select(GameSessionModel).where(GameSessionModel.state.notin_(["completed", "ended"]))
        return list(self.db.scalars(stmt))

    def save_canvas_event(
        self,
        session: GameSessionModel,
        trial_number: int,
        actor_token: str,
        action_type: str,
        payload: dict,
        timestamp_ms: int,
    ) -> CanvasEventModel:
        event = CanvasEventModel(
            session_id=session.id,
            trial_number=trial_number,
            actor_token=actor_token,
            action_type=action_type,
            payload=payload,
            timestamp_ms=timestamp_ms,
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def upsert_trial_record(
        self,
        session: GameSessionModel,
        payload: dict,
    ) -> TrialRecordModel:
        record = self.db.scalar(
            select(TrialRecordModel).where(
                TrialRecordModel.session_id == session.id,
                TrialRecordModel.trial_number == payload["trial_number"],
            )
        )
        if record is None:
            record = TrialRecordModel(session_id=session.id, trial_number=payload["trial_number"])
            self.db.add(record)

        for field, value in payload.items():
            if hasattr(record, field):
                setattr(record, field, value)
        self.db.commit()
        self.db.refresh(record)
        return record

    def save_listener_response(
        self,
        session: GameSessionModel,
        trial_record: TrialRecordModel,
        listener_token: str,
        guessed_referent: str,
        response_time_ms: int,
    ) -> ListenerResponseModel:
        response = ListenerResponseModel(
            session_id=session.id,
            trial_record_id=trial_record.id,
            listener_token=listener_token,
            guessed_referent=guessed_referent,
            response_time_ms=response_time_ms,
        )
        self.db.add(response)
        self.db.commit()
        self.db.refresh(response)
        return response

    def update_session(self, session: GameSessionModel) -> GameSessionModel:
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def save_debrief(self, participant: ParticipantModel, answers: dict) -> DebriefResponseModel:
        session_info = self.get_session_for_participant(participant)
        session_public_id = session_info[1].public_id if session_info else None
        response = DebriefResponseModel(participant_token=participant.token, session_public_id=session_public_id, answers=answers)
        participant.phase = "completed"
        if not participant.completion_code:
            participant.completion_code = f"SG-{participant.public_id.split('-')[0].upper()}"
        self.db.add(response)
        self.db.add(participant)
        self.db.commit()
        self.db.refresh(response)
        self.db.refresh(participant)
        return response

    def bootstrap_payload(self, participant: ParticipantModel, public_config: dict, manifest: dict) -> dict:
        session_info = self.get_session_for_participant(participant)
        resumable_session = None
        if session_info:
            dyad, session = session_info
            resumable_session = {
                "dyadId": dyad.public_id,
                "sessionId": session.public_id,
                "condition": dyad.condition,
                "state": session.state,
                "currentTrialNumber": session.current_trial_number,
                "cumulativeScore": session.cumulative_score,
                "history": session.prior_history,
            }
        return {
            "participant": {
                "id": participant.public_id,
                "token": participant.token,
                "phase": participant.phase,
                "consented": participant.consented,
                "audioChecked": participant.audio_checked,
                "learningState": participant.learning_state or {},
                "completionCode": participant.completion_code,
                "slot": participant.slot,
                "assignedCondition": participant.metadata_json.get("assignedCondition", "transparent"),
            },
            "studyConfig": public_config,
            "assets": manifest,
            "resumableSession": resumable_session,
        }

    def export_dyads(self) -> list[dict]:
        dyads = list(self.db.scalars(select(DyadModel)))
        exported = []
        for dyad in dyads:
            trials = []
            session = dyad.session
            if session:
                for trial in session.trial_records:
                    trials.append(
                        {
                            "game_id": session.public_id,
                            "dyad_id": dyad.public_id,
                            "condition": dyad.condition,
                            "trial_number": trial.trial_number,
                            "trial_type": trial.trial_type,
                            "speaker_id": trial.speaker_token,
                            "listener_id": trial.listener_token,
                            "target_referent": trial.target_referent,
                            "target_word": trial.target_word,
                            "choice_set": trial.choice_set,
                            "canvas_state": trial.canvas_state,
                            "canvas_action_log": trial.canvas_action_log,
                            "speaker_composition_time_ms": trial.speaker_composition_time_ms,
                            "listener_response": trial.listener_response,
                            "correct": trial.correct,
                            "listener_response_time_ms": trial.listener_response_time_ms,
                            "cumulative_score": trial.cumulative_score,
                        }
                    )
            exported.append(
                {
                    "dyadId": dyad.public_id,
                    "condition": dyad.condition,
                    "status": dyad.status,
                    "participants": [dyad.participant_a_token, dyad.participant_b_token],
                    "sessionId": session.public_id if session else None,
                    "trials": trials,
                }
            )
        return exported

    def get_or_create_participant(self, token: str | None, metadata: dict | None = None) -> ParticipantModel:
        if token:
            participant = self.get_participant_by_token(token)
            if participant:
                return participant
        return self.create_participant(metadata)
