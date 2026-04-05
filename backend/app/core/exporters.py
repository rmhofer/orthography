from __future__ import annotations

import csv
import io
import json
from typing import Iterable


def flatten_trial_rows(trials: Iterable[dict]) -> list[dict]:
    rows: list[dict] = []
    for trial in trials:
        rows.append(
            {
                "game_id": trial.get("game_id"),
                "dyad_id": trial.get("dyad_id"),
                "condition": trial.get("condition"),
                "trial_number": trial.get("trial_number"),
                "trial_type": trial.get("trial_type"),
                "speaker_id": trial.get("speaker_id"),
                "listener_id": trial.get("listener_id"),
                "target_referent": trial.get("target_referent"),
                "target_word": trial.get("target_word"),
                "choice_set": json.dumps(trial.get("choice_set", [])),
                "canvas_state": json.dumps(trial.get("canvas_state", {})),
                "canvas_action_log": json.dumps(trial.get("canvas_action_log", [])),
                "speaker_composition_time_ms": trial.get("speaker_composition_time_ms"),
                "listener_response": trial.get("listener_response"),
                "correct": trial.get("correct"),
                "listener_response_time_ms": trial.get("listener_response_time_ms"),
                "cumulative_score": trial.get("cumulative_score"),
            }
        )
    return rows


def trials_to_csv(trials: Iterable[dict]) -> str:
    rows = flatten_trial_rows(trials)
    if not rows:
        return ""
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()
