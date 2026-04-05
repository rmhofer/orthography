from app.core.learning import LearningProgress


def test_learning_progress_requires_full_window() -> None:
    progress = LearningProgress()
    for _ in range(9):
        progress.record_quiz(True)
    assert progress.passed(0.8) is False


def test_learning_progress_passes_with_threshold() -> None:
    progress = LearningProgress()
    for outcome in [True, True, True, True, False, True, True, True, True, False]:
        progress.record_quiz(outcome)
    assert progress.passed(0.8) is True
