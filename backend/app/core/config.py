from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SYMBOL_GAMES_", extra="ignore")

    app_name: str = "Symbol Games API"
    environment: str = "development"
    api_prefix: str = "/api"
    database_url: str = f"sqlite:///{ROOT_DIR / 'symbol_games.db'}"
    admin_password: str = "researcher"
    admin_secret: str = "change-me-in-production"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])
    assets_dir: Path = ROOT_DIR / "assets"
    manifest_path: Path = ROOT_DIR / "assets" / "manifests" / "stimuli-manifest.json"
    frontend_dist_dir: Path = ROOT_DIR / "frontend" / "dist"
    pairing_mode: str = "auto"
    total_trials: int = 60
    role_swap_every: int = 1
    max_primitives_per_form: int = 10
    learning_criterion: float = 0.8
    choice_set_size: int = 6
    inter_trial_interval_ms: int = 1500
    speaker_time_limit_s: int = 45
    points_per_correct: int = 10
    reconnect_grace_seconds: int = 10
    lobby_wait_limit_seconds: int = 180
    history_preview_size: int = 3
    view_mode: str = "transmit"
    interface_type: str = "blocks"
    seismograph_mode: str = "hold_to_draw"
    inertial_alpha: float = 0.15
    completion_code_prefix: str = "SG"

    def public_study_config(self) -> dict:
        return {
            "condition": "random",
            "viewMode": self.view_mode,
            "totalTrials": self.total_trials,
            "roleSwapEvery": self.role_swap_every,
            "maxPrimitivesPerForm": self.max_primitives_per_form,
            "learningCriterion": self.learning_criterion,
            "choiceSetSize": self.choice_set_size,
            "pairingMode": self.pairing_mode,
            "interTrialIntervalMs": self.inter_trial_interval_ms,
            "speakerTimeLimitS": self.speaker_time_limit_s,
            "pointsPerCorrect": self.points_per_correct,
            "showWordAudioToSpeaker": True,
            "historyPreviewSize": self.history_preview_size,
            "interfaceType": self.interface_type,
            "seismographMode": self.seismograph_mode,
            "inertialAlpha": self.inertial_alpha,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
