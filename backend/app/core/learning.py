from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field


@dataclass
class LearningProgress:
    heard_forms: set[str] = field(default_factory=set)
    quiz_window: deque[bool] = field(default_factory=lambda: deque(maxlen=10))
    quiz_trials: int = 0
    quiz_correct: int = 0
    practice_trials_completed: int = 0

    def record_heard(self, referent_id: str) -> None:
        self.heard_forms.add(referent_id)

    def record_quiz(self, correct: bool) -> None:
        self.quiz_trials += 1
        if correct:
            self.quiz_correct += 1
        self.quiz_window.append(correct)

    @property
    def sliding_accuracy(self) -> float:
        if not self.quiz_window:
            return 0.0
        return sum(self.quiz_window) / len(self.quiz_window)

    def exposure_complete(self, expected_forms: set[str]) -> bool:
        return expected_forms.issubset(self.heard_forms)

    def passed(self, threshold: float = 0.8) -> bool:
        return len(self.quiz_window) >= 10 and self.sliding_accuracy >= threshold
