from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import random
from typing import Literal

from .stimuli import STEMS, ModifierId, build_referents, get_stem, referent_id

TrialType = Literal["warmup", "stem_discrimination", "modifier_discrimination", "cross_cutting", "opaque_critical"]
Role = Literal["speaker", "listener"]
Condition = Literal["transparent", "opaque"]


@dataclass(frozen=True)
class TrialDefinition:
    trial_number: int
    trial_type: TrialType
    target_referent: str
    choice_set: list[str]
    speaker_slot: Literal["participant_a", "participant_b"]

    def to_dict(self) -> dict:
        return asdict(self)


REFERENTS = build_referents()
REFERENT_IDS = [referent.id for referent in REFERENTS]
BARE_IDS = [referent.id for referent in REFERENTS if referent.modifier_id == "bare"]
VOWEL_STEMS = [stem.id for stem in STEMS if stem.final_class == "vowel"]
CONSONANT_STEMS = [stem.id for stem in STEMS if stem.final_class == "consonant"]


def _rng_from_seed(seed: str) -> random.Random:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return random.Random(int(digest[:16], 16))


def _shuffle(rng: random.Random, items: list[str]) -> list[str]:
    copy = list(items)
    rng.shuffle(copy)
    return copy


def _modifier_cycle(rng: random.Random, stem_id: str, count: int) -> list[str]:
    modifiers: list[ModifierId] = ["bare", "mod_a", "mod_b"]
    return [referent_id(stem_id, modifiers[index % len(modifiers)]) for index in range(count)]


def _stem_distractors(rng: random.Random, excluded_stem: str, count: int) -> list[str]:
    pool = [stem.id for stem in STEMS if stem.id != excluded_stem]
    return [referent_id(stem_id, "bare") for stem_id in _shuffle(rng, pool)[:count]]


def _any_other_referents(rng: random.Random, excluded: set[str], count: int) -> list[str]:
    pool = [rid for rid in REFERENT_IDS if rid not in excluded]
    return _shuffle(rng, pool)[:count]


def _build_warmup_trials(rng: random.Random) -> list[tuple[TrialType, str, list[str]]]:
    trials: list[tuple[TrialType, str, list[str]]] = []
    for target in _shuffle(rng, BARE_IDS):
        stem_id = target
        distractors = _stem_distractors(rng, stem_id, 5)
        choice_set = _shuffle(rng, [target, *distractors])
        trials.append(("warmup", target, choice_set))
    return trials


def _build_stem_discrimination_trials(rng: random.Random, count: int) -> list[tuple[TrialType, str, list[str]]]:
    trials: list[tuple[TrialType, str, list[str]]] = []
    target_pool = _shuffle(rng, REFERENT_IDS * 2)
    for index in range(count):
        target = target_pool[index]
        target_stem = target.split("_")[0]
        distractor_stems = [stem.id for stem in STEMS if stem.id != target_stem]
        chosen = _shuffle(rng, distractor_stems)
        bare_distractors = [referent_id(stem_id, "bare") for stem_id in chosen[:4]]
        modified_stem = chosen[4]
        modified_variant = referent_id(modified_stem, rng.choice(["mod_a", "mod_b"]))
        choice_set = _shuffle(rng, [target, *bare_distractors, modified_variant])
        trials.append(("stem_discrimination", target, choice_set))
    return trials


def _build_modifier_trials(rng: random.Random, count: int) -> list[tuple[TrialType, str, list[str]]]:
    trials: list[tuple[TrialType, str, list[str]]] = []
    stems = _shuffle(rng, [stem.id for stem in STEMS] * 2)
    modifiers: list[ModifierId] = ["bare", "mod_a", "mod_b"]
    for index in range(count):
        stem_id = stems[index]
        target = referent_id(stem_id, modifiers[index % 3])
        paradigm = [referent_id(stem_id, modifier) for modifier in modifiers]
        distractors = _stem_distractors(rng, stem_id, 3)
        choice_set = _shuffle(rng, [*paradigm, *distractors])
        trials.append(("modifier_discrimination", target, choice_set))
    return trials


def _build_cross_cutting_trials(rng: random.Random, count: int) -> list[tuple[TrialType, str, list[str]]]:
    trials: list[tuple[TrialType, str, list[str]]] = []
    modifiers: list[ModifierId] = ["bare", "mod_a", "mod_b"]
    stem_pairs = []
    stems = [stem.id for stem in STEMS]
    for _ in range(count):
        pair = _shuffle(rng, stems)[:2]
        stem_pairs.append(pair)

    for index, pair in enumerate(stem_pairs):
        choice_set = [referent_id(stem_id, modifier) for stem_id in pair for modifier in modifiers]
        target = choice_set[index % len(choice_set)]
        trials.append(("cross_cutting", target, _shuffle(rng, choice_set)))
    return trials


def _build_opaque_critical_trials(rng: random.Random, condition: Condition, count: int) -> list[tuple[TrialType, str, list[str]]]:
    trials: list[tuple[TrialType, str, list[str]]] = []
    modifiers: list[ModifierId] = ["bare", "mod_a", "mod_b"]

    if condition == "opaque":
        stem_pool = VOWEL_STEMS
    else:
        stem_pool = [VOWEL_STEMS[index % len(VOWEL_STEMS)] if index % 2 == 0 else CONSONANT_STEMS[index % len(CONSONANT_STEMS)] for index in range(len(VOWEL_STEMS))]

    for index in range(count):
        first, second = _shuffle(rng, stem_pool)[:2]
        choice_set = [referent_id(stem_id, modifier) for stem_id in [first, second] for modifier in modifiers]
        target = choice_set[index % len(choice_set)]
        trials.append(("opaque_critical", target, _shuffle(rng, choice_set)))
    return trials


def build_schedule(seed: str, condition: Condition, total_trials: int = 60) -> list[TrialDefinition]:
    if total_trials != 60:
        raise ValueError("The v1 schedule is fixed at 60 trials.")

    rng = _rng_from_seed(f"{seed}:{condition}:{total_trials}")
    trial_specs = [
        *_build_warmup_trials(rng),
        *_build_stem_discrimination_trials(rng, 10),
        *_build_modifier_trials(rng, 15),
        *_build_cross_cutting_trials(rng, 15),
        *_build_opaque_critical_trials(rng, condition, 10),
    ]

    if len(trial_specs) != total_trials:
        raise AssertionError(f"Expected {total_trials} trials, got {len(trial_specs)}")

    schedule: list[TrialDefinition] = []
    for index, (trial_type, target_referent, choice_set) in enumerate(trial_specs, start=1):
        schedule.append(
            TrialDefinition(
                trial_number=index,
                trial_type=trial_type,
                target_referent=target_referent,
                choice_set=choice_set,
                speaker_slot="participant_a" if index % 2 == 1 else "participant_b",
            )
        )
    return schedule


def build_generic_schedule(
    seed: str,
    referent_ids: list[str],
    groups: dict[str, list[str]],
    total_trials: int = 60,
    choice_set_size: int = 6,
) -> list[TrialDefinition]:
    """Domain-agnostic schedule builder for procedural referent domains.

    Args:
        seed: deterministic seed string
        referent_ids: all referent IDs
        groups: mapping from group_id -> list of referent IDs in that group
        total_trials: number of trials to generate
        choice_set_size: number of referents per choice set
    """
    rng = _rng_from_seed(seed)
    schedule: list[TrialDefinition] = []
    group_ids = list(groups.keys())

    for trial_num in range(1, total_trials + 1):
        # Pick a target referent
        target = rng.choice(referent_ids)
        target_group = next((g for g, members in groups.items() if target in members), group_ids[0])

        # Build choice set: include target + same-group items + random distractors
        same_group = [r for r in groups.get(target_group, []) if r != target]
        other = [r for r in referent_ids if r != target and r not in same_group]
        rng.shuffle(same_group)
        rng.shuffle(other)

        # Include 1-2 same-group + fill rest with distractors
        n_same = min(2, len(same_group))
        n_other = choice_set_size - 1 - n_same
        choice_set = [target] + same_group[:n_same] + other[:n_other]
        rng.shuffle(choice_set)

        # Determine trial type based on position in the schedule
        frac = trial_num / total_trials
        if frac <= 0.15:
            trial_type = "warmup"
        elif frac <= 0.4:
            trial_type = "group_discrimination"
        elif frac <= 0.7:
            trial_type = "variant_discrimination"
        else:
            trial_type = "cross_cutting"

        schedule.append(TrialDefinition(
            trial_number=trial_num,
            trial_type=trial_type,
            target_referent=target,
            choice_set=choice_set,
            speaker_slot="participant_a" if trial_num % 2 == 1 else "participant_b",
        ))
    return schedule


def role_for_trial(trial_number: int, participant_slot: Literal["participant_a", "participant_b"]) -> Role:
    speaker_slot = "participant_a" if trial_number % 2 == 1 else "participant_b"
    return "speaker" if participant_slot == speaker_slot else "listener"
