from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
import json
import random
import time
from typing import Any

from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.schedule import role_for_trial
from app.core.stimuli import build_manifest, build_referents, word_for_referent
from app.db.models import DyadModel, GameSessionModel, ParticipantModel
from app.db.repository import Repository


@dataclass
class ActiveTrialState:
    canvas_state: dict = field(default_factory=dict)  # opaque, stores final canvasState from frontend
    action_log: list[dict] = field(default_factory=list)
    started_at_ms: int = field(default_factory=lambda: int(time.time() * 1000))
    submitted_at_ms: int | None = None


@dataclass
class ActiveSession:
    dyad_public_id: str
    session_public_id: str
    session_db_id: int
    condition: str
    config_snapshot: dict
    schedule: list[dict]
    current_trial_number: int
    cumulative_score: int
    participants: dict[str, str]
    prior_history: list[dict] = field(default_factory=list)
    state: str = "ready"
    paused: bool = False
    sockets: dict[str, WebSocket] = field(default_factory=dict)
    disconnect_deadlines: dict[str, float] = field(default_factory=dict)
    current_trial_state: ActiveTrialState = field(default_factory=ActiveTrialState)

    def trial_definition(self) -> dict:
        return self.schedule[self.current_trial_number - 1]

    def slot_for_token(self, token: str) -> str:
        for slot, slot_token in self.participants.items():
            if slot_token == token:
                return slot
        raise KeyError(token)

    def other_token(self, token: str) -> str:
        return next(other for other in self.participants.values() if other != token)


class SessionManager:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.manifest = build_manifest()
        self.referents = {referent.id: referent for referent in build_referents()}
        self.active_sessions: dict[str, ActiveSession] = {}
        self.token_to_session: dict[str, str] = {}

    def study_config(self, db: Session) -> dict:
        stored = Repository(db).get_admin_config()
        return {**self.settings.public_study_config(), **stored}

    def _load_session(self, db: Session, participant: ParticipantModel) -> ActiveSession | None:
        repository = Repository(db)
        session_info = repository.get_session_for_participant(participant)
        if not session_info:
            return None
        dyad, session = session_info
        if session.public_id in self.active_sessions:
            return self.active_sessions[session.public_id]

        active = ActiveSession(
            dyad_public_id=dyad.public_id,
            session_public_id=session.public_id,
            session_db_id=session.id,
            condition=dyad.condition,
            config_snapshot=dyad.config_snapshot or self.settings.public_study_config(),
            schedule=session.schedule_json,
            current_trial_number=session.current_trial_number,
            cumulative_score=session.cumulative_score,
            participants={
                "participant_a": dyad.participant_a_token,
                "participant_b": dyad.participant_b_token,
            },
            prior_history=session.prior_history or [],
            state=session.state,
            paused=session.paused,
        )
        self.active_sessions[session.public_id] = active
        for token in active.participants.values():
            self.token_to_session[token] = active.session_public_id
        return active

    def bootstrap(self, db: Session, participant: ParticipantModel) -> dict:
        repository = Repository(db)
        return repository.bootstrap_payload(participant, self.study_config(db), self.manifest)

    def record_consent(self, db: Session, participant: ParticipantModel, consented: bool) -> ParticipantModel:
        participant.consented = consented
        participant.phase = "consent_complete" if consented else "landing"
        return Repository(db).update_participant(participant)

    def record_audio_check(self, db: Session, participant: ParticipantModel, passed: bool) -> ParticipantModel:
        participant.audio_checked = passed
        participant.phase = "learning" if passed and participant.consented else participant.phase
        return Repository(db).update_participant(participant)

    def record_exposure(self, db: Session, participant: ParticipantModel, referent_id: str) -> ParticipantModel:
        state = participant.learning_state or {}
        heard = set(state.get("heardForms", []))
        heard.add(referent_id)
        state["heardForms"] = sorted(heard)
        participant.learning_state = state
        return Repository(db).update_participant(participant)

    def record_quiz(self, db: Session, participant: ParticipantModel, correct: bool) -> dict:
        config = self.study_config(db)
        state = participant.learning_state or {}
        window = state.get("quizWindow", [])
        window.append(correct)
        window = window[-10:]
        state["quizWindow"] = window
        state["quizTrials"] = state.get("quizTrials", 0) + 1
        state["quizCorrect"] = state.get("quizCorrect", 0) + (1 if correct else 0)
        participant.learning_state = state
        Repository(db).update_participant(participant)
        accuracy = sum(window) / len(window) if window else 0.0
        return {"slidingAccuracy": accuracy, "windowSize": len(window), "passed": len(window) >= 10 and accuracy >= config["learningCriterion"]}

    def complete_learning(self, db: Session, participant: ParticipantModel, practice_trials_completed: int) -> ParticipantModel:
        state = participant.learning_state or {}
        state["practiceTrialsCompleted"] = practice_trials_completed
        participant.learning_state = state
        participant.phase = "ready_for_lobby"
        return Repository(db).update_participant(participant)

    def join_lobby(self, db: Session, participant: ParticipantModel) -> dict:
        repository = Repository(db)
        config = self.study_config(db)
        repository.queue_participant(participant)
        paired = None
        if config["pairingMode"] == "auto":
            waiting = repository.list_waiting_participants()
            # Group by (assignedCondition, interfaceType) — only same-interface participants can pair
            grouped: dict[tuple[str, str], list[ParticipantModel]] = {}
            for wp in waiting:
                key = (
                    wp.metadata_json.get("assignedCondition", "transparent"),
                    wp.metadata_json.get("interfaceType", "blocks"),
                )
                grouped.setdefault(key, []).append(wp)
            for key, group in grouped.items():
                if len(group) >= 2:
                    paired = self.pair_participants(db, group[0], group[1], key[0])
                    break
        return {"participantPhase": participant.phase, "pairedSession": paired}

    def pair_participants(
        self,
        db: Session,
        participant_a: ParticipantModel,
        participant_b: ParticipantModel,
        condition: str,
    ) -> dict:
        repository = Repository(db)
        config = self.study_config(db)
        if condition == "random":
            if participant_a.metadata_json.get("assignedCondition") == participant_b.metadata_json.get("assignedCondition"):
                chosen = participant_a.metadata_json.get("assignedCondition", "transparent")
            else:
                chosen = random.choice(["transparent", "opaque"])
        else:
            chosen = condition
        participant_a.metadata_json["assignedCondition"] = chosen
        participant_b.metadata_json["assignedCondition"] = chosen
        dyad, session = repository.create_dyad(participant_a, participant_b, chosen, config)
        active = self._load_session(db, participant_a)
        assert active is not None
        payload = {
            "dyadId": dyad.public_id,
            "sessionId": session.public_id,
            "condition": dyad.condition,
            "participantTokens": [participant_a.token, participant_b.token],
        }
        return payload

    async def connect(self, db: Session, participant: ParticipantModel, websocket: WebSocket) -> ActiveSession | None:
        await websocket.accept()
        active = self._load_session(db, participant)
        if active is None:
            await websocket.send_json({"event": "phase_sync", "payload": self.bootstrap(db, participant)})
            return None
        active.sockets[participant.token] = websocket
        active.disconnect_deadlines.pop(participant.token, None)
        self.token_to_session[participant.token] = active.session_public_id
        await websocket.send_json({"event": "phase_sync", "payload": self.phase_sync_payload(participant.token, active)})
        if len(active.sockets) == 2:
            for token in active.participants.values():
                await self.send_to(active, token, {"event": "session_resumed", "payload": self.current_trial_payload(active, token)})
        return active

    async def disconnect(self, token: str) -> None:
        session_id = self.token_to_session.get(token)
        if not session_id:
            return
        active = self.active_sessions.get(session_id)
        if active is None:
            return
        active.sockets.pop(token, None)
        deadline = time.time() + self.settings.reconnect_grace_seconds
        active.disconnect_deadlines[token] = deadline
        for other_token, socket in active.sockets.items():
            await socket.send_json(
                {
                    "event": "partner_disconnected",
                    "payload": {"token": token, "reconnectGraceSeconds": self.settings.reconnect_grace_seconds},
                }
            )

    def phase_sync_payload(self, token: str, active: ActiveSession) -> dict:
        history_size = active.config_snapshot.get("historyPreviewSize", self.settings.history_preview_size)
        return {
            "sessionId": active.session_public_id,
            "dyadId": active.dyad_public_id,
            "condition": active.condition,
            "trial": self.current_trial_payload(active, token),
            "score": active.cumulative_score,
            "history": active.prior_history[-history_size:],
            "paused": active.paused,
        }

    def current_trial_payload(self, active: ActiveSession, token: str | None = None) -> dict:
        trial = active.trial_definition()
        speaker_token = active.participants[trial["speaker_slot"]]
        listener_token = active.other_token(speaker_token)
        role = role_for_trial(trial["trial_number"], active.slot_for_token(token or speaker_token)) if token else "speaker"
        target = self.referents[trial["target_referent"]]
        payload = {
            "trialNumber": trial["trial_number"],
            "trialType": trial["trial_type"],
            "role": role,
            "choiceSet": trial["choice_set"],
            "targetReferent": trial["target_referent"],
            "targetAudioUrl": self.manifest["referents"][next(index for index, item in enumerate(self.manifest["referents"]) if item["id"] == target.id)]["audio"][active.condition] if role == "speaker" else None,
            "timerSeconds": active.config_snapshot.get("speakerTimeLimitS", self.settings.speaker_time_limit_s),
            "score": active.cumulative_score,
            "history": active.prior_history[-active.config_snapshot.get("historyPreviewSize", self.settings.history_preview_size) :],
            "condition": active.condition,
            "speakerToken": speaker_token,
            "listenerToken": listener_token,
        }
        return payload

    async def handle_event(self, db: Session, participant: ParticipantModel, message: dict[str, Any]) -> None:
        session_id = self.token_to_session.get(participant.token)
        if not session_id:
            return
        active = self.active_sessions[session_id]
        event = message.get("event")
        payload = message.get("payload", {})

        if event == "heartbeat":
            socket = active.sockets.get(participant.token)
            if socket:
                await socket.send_json({"event": "heartbeat", "payload": {"serverTimeMs": int(time.time() * 1000)}})
            return

        if active.paused and event not in {"heartbeat"}:
            socket = active.sockets.get(participant.token)
            if socket:
                await socket.send_json({"event": "session_paused", "payload": {"sessionId": active.session_public_id}})
            return

        repository = Repository(db)
        trial = active.trial_definition()
        trial_number = trial["trial_number"]
        speaker_token = active.participants[trial["speaker_slot"]]
        listener_token = active.other_token(speaker_token)

        if event == "canvas_action":
            if participant.token != speaker_token:
                return
            active.current_trial_state.action_log.append(payload)
            action_type = payload.get("action", "unknown")
            repository.save_canvas_event(active_session_to_db_session(db, active), trial_number, participant.token, action_type, payload, payload.get("timestampMs", 0))
            # Live-stream: forward action to listener in real-time
            await self.send_to(active, listener_token, {"event": "canvas_action_relay", "payload": payload})
            return

        if event == "canvas_snapshot":
            if participant.token != speaker_token:
                return
            active.current_trial_state.submitted_at_ms = payload.get("submittedAtMs", int(time.time() * 1000))
            canvas_state = payload.get("canvasState", {})
            active.current_trial_state.canvas_state = canvas_state
            await self.send_to(active, listener_token, {"event": "speaker_done", "payload": {"trialNumber": trial_number, "canvasState": canvas_state}})
            return

        if event == "listener_guess":
            if participant.token != listener_token:
                return
            response_referent = payload["selectedReferent"]
            correct = response_referent == trial["target_referent"]
            if correct:
                active.cumulative_score += self.study_config(db)["pointsPerCorrect"]
            target_word = word_for_referent(self.referents[trial["target_referent"]], active.condition)  # type: ignore[arg-type]
            composition_time_ms = max(
                0,
                (active.current_trial_state.submitted_at_ms or int(time.time() * 1000)) - active.current_trial_state.started_at_ms,
            )
            trial_payload = {
                "trial_number": trial_number,
                "trial_type": trial["trial_type"],
                "speaker_token": speaker_token,
                "listener_token": listener_token,
                "target_referent": trial["target_referent"],
                "target_word": target_word,
                "choice_set": trial["choice_set"],
                "canvas_state": active.current_trial_state.canvas_state,
                "canvas_action_log": active.current_trial_state.action_log,
                "speaker_composition_time_ms": composition_time_ms,
                "listener_response": response_referent,
                "correct": correct,
                "listener_response_time_ms": payload.get("responseTimeMs", 0),
                "cumulative_score": active.cumulative_score,
            }
            session_model = active_session_to_db_session(db, active)
            record = repository.upsert_trial_record(session_model, trial_payload)
            repository.save_listener_response(session_model, record, listener_token, response_referent, payload.get("responseTimeMs", 0))

            active.prior_history.append(
                {
                    "trialNumber": trial_number,
                    "targetReferent": trial["target_referent"],
                    "canvasState": active.current_trial_state.canvas_state,
                }
            )
            await self.broadcast(
                active,
                {
                    "event": "feedback",
                    "payload": {
                        "trialNumber": trial_number,
                        "targetReferent": trial["target_referent"],
                        "selectedReferent": response_referent,
                        "correct": correct,
                        "score": active.cumulative_score,
                    },
                },
            )
            await asyncio.sleep(self.study_config(db)["interTrialIntervalMs"] / 1000)
            await self.advance_trial(db, active)

    async def advance_trial(self, db: Session, active: ActiveSession) -> None:
        active.current_trial_number += 1
        active.current_trial_state = ActiveTrialState()
        repository = Repository(db)
        session_model = active_session_to_db_session(db, active)
        session_model.current_trial_number = active.current_trial_number
        session_model.cumulative_score = active.cumulative_score
        session_model.prior_history = active.prior_history[-active.config_snapshot.get("historyPreviewSize", self.settings.history_preview_size) :]

        if active.current_trial_number > len(active.schedule):
            session_model.state = "completed"
            repository.update_session(session_model)
            for token in active.participants.values():
                participant = repository.get_participant_by_token(token)
                if participant:
                    participant.phase = "debrief"
                    repository.update_participant(participant)
            await self.broadcast(active, {"event": "role_swap", "payload": {"completed": True, "nextPhase": "debrief"}})
            return

        session_model.state = "in_progress"
        repository.update_session(session_model)
        for token in active.participants.values():
            await self.send_to(active, token, {"event": "role_swap", "payload": self.current_trial_payload(active, token)})

    async def broadcast(self, active: ActiveSession, message: dict[str, Any]) -> None:
        for token in list(active.sockets):
            await self.send_to(active, token, message)

    async def send_to(self, active: ActiveSession, token: str, message: dict[str, Any]) -> None:
        socket = active.sockets.get(token)
        if socket is None:
            return
        await socket.send_json(message)

    def pause_session(self, db: Session, session_public_id: str) -> None:
        active = self.active_sessions.get(session_public_id)
        if active:
            active.paused = True
        session = Repository(db).get_session_by_public_id(session_public_id)
        if session:
            session.paused = True
            session.state = "paused"
            Repository(db).update_session(session)

    def resume_session(self, db: Session, session_public_id: str) -> None:
        active = self.active_sessions.get(session_public_id)
        if active:
            active.paused = False
        session = Repository(db).get_session_by_public_id(session_public_id)
        if session:
            session.paused = False
            session.state = "in_progress"
            Repository(db).update_session(session)

    def end_session(self, db: Session, session_public_id: str) -> None:
        active = self.active_sessions.get(session_public_id)
        if active:
            active.paused = True
            active.state = "ended"
        session = Repository(db).get_session_by_public_id(session_public_id)
        if session:
            session.state = "ended"
            Repository(db).update_session(session)


def active_session_to_db_session(db: Session, active: ActiveSession) -> GameSessionModel:
    session = Repository(db).get_session_by_public_id(active.session_public_id)
    if session is None:
        raise RuntimeError(f"Missing session {active.session_public_id}")
    return session
