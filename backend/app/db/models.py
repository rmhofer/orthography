from __future__ import annotations

from datetime import UTC, datetime
import uuid

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ParticipantModel(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(String(64), unique=True, default=_uuid)
    token: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    phase: Mapped[str] = mapped_column(String(32), default="landing")
    consented: Mapped[bool] = mapped_column(Boolean, default=False)
    audio_checked: Mapped[bool] = mapped_column(Boolean, default=False)
    learning_state: Mapped[dict] = mapped_column(JSON, default=dict)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    dyad_id: Mapped[int | None] = mapped_column(ForeignKey("dyads.id"), nullable=True)
    slot: Mapped[str | None] = mapped_column(String(32), nullable=True)
    waiting_joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completion_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    dyad = relationship("DyadModel", back_populates="participants")


class DyadModel(Base):
    __tablename__ = "dyads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(String(64), unique=True, default=_uuid)
    condition: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="paired")
    view_mode: Mapped[str] = mapped_column(String(16), default="transmit")
    config_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    participant_a_token: Mapped[str] = mapped_column(String(128))
    participant_b_token: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    participants = relationship("ParticipantModel", back_populates="dyad")
    session = relationship("GameSessionModel", back_populates="dyad", uselist=False)


class GameSessionModel(Base):
    __tablename__ = "game_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(String(64), unique=True, default=_uuid)
    dyad_id: Mapped[int] = mapped_column(ForeignKey("dyads.id"), unique=True)
    state: Mapped[str] = mapped_column(String(32), default="waiting_for_connections")
    current_trial_number: Mapped[int] = mapped_column(Integer, default=1)
    cumulative_score: Mapped[int] = mapped_column(Integer, default=0)
    schedule_json: Mapped[list] = mapped_column(JSON, default=list)
    prior_history: Mapped[list] = mapped_column(JSON, default=list)
    paused: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    dyad = relationship("DyadModel", back_populates="session")
    trial_records = relationship("TrialRecordModel", back_populates="session")


class TrialRecordModel(Base):
    __tablename__ = "trial_records"
    __table_args__ = (UniqueConstraint("session_id", "trial_number", name="uq_trial_per_session"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("game_sessions.id"))
    trial_number: Mapped[int] = mapped_column(Integer)
    trial_type: Mapped[str] = mapped_column(String(64))
    speaker_token: Mapped[str] = mapped_column(String(128))
    listener_token: Mapped[str] = mapped_column(String(128))
    target_referent: Mapped[str] = mapped_column(String(128))
    target_word: Mapped[str] = mapped_column(String(128))
    choice_set: Mapped[list] = mapped_column(JSON, default=list)
    canvas_state: Mapped[dict] = mapped_column(JSON, default=dict)
    canvas_action_log: Mapped[list] = mapped_column(JSON, default=list)
    speaker_composition_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    listener_response: Mapped[str | None] = mapped_column(String(128), nullable=True)
    correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    listener_response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cumulative_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    session = relationship("GameSessionModel", back_populates="trial_records")
    responses = relationship("ListenerResponseModel", back_populates="trial_record")


class CanvasEventModel(Base):
    __tablename__ = "canvas_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("game_sessions.id"))
    trial_number: Mapped[int] = mapped_column(Integer)
    actor_token: Mapped[str] = mapped_column(String(128))
    action_type: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    timestamp_ms: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ListenerResponseModel(Base):
    __tablename__ = "listener_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("game_sessions.id"))
    trial_record_id: Mapped[int] = mapped_column(ForeignKey("trial_records.id"))
    listener_token: Mapped[str] = mapped_column(String(128))
    guessed_referent: Mapped[str] = mapped_column(String(128))
    response_time_ms: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    trial_record = relationship("TrialRecordModel", back_populates="responses")


class DebriefResponseModel(Base):
    __tablename__ = "debrief_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participant_token: Mapped[str] = mapped_column(String(128), index=True)
    session_public_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    answers: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AdminConfigModel(Base):
    __tablename__ = "admin_configs"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
