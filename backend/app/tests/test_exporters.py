from app.core.exporters import flatten_trial_rows, trials_to_csv


SAMPLE_TRIAL = {
    "game_id": "game-1",
    "dyad_id": "dyad-1",
    "condition": "opaque",
    "trial_number": 14,
    "trial_type": "modifier_discrimination",
    "speaker_id": "participant-a",
    "listener_id": "participant-b",
    "target_referent": "talu_mod_a",
    "target_word": "talka",
    "choice_set": ["talu", "talu_mod_a"],
    "canvas_state": {"primitives": [{"id": "stroke_bar"}]},
    "canvas_action_log": [{"action": "place"}],
    "speaker_composition_time_ms": 1200,
    "listener_response": "talu_mod_a",
    "correct": True,
    "listener_response_time_ms": 900,
    "cumulative_score": 20,
}


def test_csv_export_contains_headers_and_serialized_fields() -> None:
    rows = flatten_trial_rows([SAMPLE_TRIAL])
    assert rows[0]["target_word"] == "talka"
    csv_output = trials_to_csv([SAMPLE_TRIAL])
    assert "canvas_state" in csv_output
    assert "modifier_discrimination" in csv_output
