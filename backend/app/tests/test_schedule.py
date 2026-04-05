from collections import Counter

from app.core.schedule import build_schedule, role_for_trial


def test_schedule_distribution_matches_v1_plan() -> None:
    schedule = build_schedule("seed-123", "opaque")
    counts = Counter(trial.trial_type for trial in schedule)
    assert len(schedule) == 60
    assert counts["warmup"] == 10
    assert counts["stem_discrimination"] == 10
    assert counts["modifier_discrimination"] == 15
    assert counts["cross_cutting"] == 15
    assert counts["opaque_critical"] == 10


def test_roles_alternate_every_trial() -> None:
    assert role_for_trial(1, "participant_a") == "speaker"
    assert role_for_trial(1, "participant_b") == "listener"
    assert role_for_trial(2, "participant_a") == "listener"
    assert role_for_trial(2, "participant_b") == "speaker"
