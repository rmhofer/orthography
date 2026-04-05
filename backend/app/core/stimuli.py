from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Condition = Literal["transparent", "opaque"]
ModifierId = Literal["bare", "mod_a", "mod_b"]


@dataclass(frozen=True)
class Stem:
    id: str
    surface: str
    label: str
    final_class: Literal["vowel", "consonant"]
    shape_id: str


@dataclass(frozen=True)
class Modifier:
    id: ModifierId
    label: str
    suffix: str
    variant: Literal["base", "red", "large"]
    description: str


@dataclass(frozen=True)
class Primitive:
    id: str
    category: Literal["stroke", "enclosure", "complex", "decorator"]
    label: str
    filename: str


@dataclass(frozen=True)
class Referent:
    id: str
    stem_id: str
    modifier_id: ModifierId
    label: str
    image_filename: str
    audio_id: str


STEMS: tuple[Stem, ...] = (
    Stem("talu", "talu", "Object 1", "vowel", "orbital"),
    Stem("miso", "miso", "Object 2", "vowel", "spire"),
    Stem("neku", "neku", "Object 3", "vowel", "kite"),
    Stem("sola", "sola", "Object 4", "vowel", "crest"),
    Stem("kupi", "kupi", "Object 5", "vowel", "petal"),
    Stem("rem", "rem", "Object 6", "consonant", "star"),
    Stem("tun", "tun", "Object 7", "consonant", "arch"),
    Stem("sik", "sik", "Object 8", "consonant", "drop"),
    Stem("pol", "pol", "Object 9", "consonant", "hex"),
    Stem("fam", "fam", "Object 10", "consonant", "spark"),
)

MODIFIERS: tuple[Modifier, ...] = (
    Modifier("bare", "Bare", "", "base", "Base object"),
    Modifier("mod_a", "Modifier A", "ika", "red", "Red variant"),
    Modifier("mod_b", "Modifier B", "onu", "large", "Large variant"),
)

PRIMITIVES: tuple[Primitive, ...] = (
    Primitive("stroke_bar", "stroke", "Horizontal bar", "primitive-stroke-bar.svg"),
    Primitive("stroke_pillar", "stroke", "Vertical bar", "primitive-stroke-pillar.svg"),
    Primitive("stroke_slash", "stroke", "Diagonal slash", "primitive-stroke-slash.svg"),
    Primitive("stroke_hook", "stroke", "Curve hook", "primitive-stroke-hook.svg"),
    Primitive("enclosure_square", "enclosure", "Square", "primitive-enclosure-square.svg"),
    Primitive("enclosure_circle", "enclosure", "Circle", "primitive-enclosure-circle.svg"),
    Primitive("enclosure_triangle", "enclosure", "Triangle", "primitive-enclosure-triangle.svg"),
    Primitive("enclosure_halfbox", "enclosure", "Half box", "primitive-enclosure-halfbox.svg"),
    Primitive("complex_cross", "complex", "Cross", "primitive-complex-cross.svg"),
    Primitive("complex_dots", "complex", "Dot cluster", "primitive-complex-dots.svg"),
    Primitive("complex_zigzag", "complex", "Zigzag", "primitive-complex-zigzag.svg"),
    Primitive("complex_spiral", "complex", "Spiral", "primitive-complex-spiral.svg"),
    Primitive("decorator_tick", "decorator", "Tick", "primitive-decorator-tick.svg"),
    Primitive("decorator_wave", "decorator", "Wave", "primitive-decorator-wave.svg"),
    Primitive("decorator_arrow", "decorator", "Arrow", "primitive-decorator-arrow.svg"),
    Primitive("decorator_ring", "decorator", "Ring", "primitive-decorator-ring.svg"),
    Primitive("stroke_arc", "stroke", "Arc", "primitive-stroke-arc.svg"),
    Primitive("enclosure_diamond", "enclosure", "Diamond", "primitive-enclosure-diamond.svg"),
    Primitive("complex_star", "complex", "Star", "primitive-complex-star.svg"),
    Primitive("decorator_dash", "decorator", "Dash", "primitive-decorator-dash.svg"),
)


def get_stem(stem_id: str) -> Stem:
    return next(stem for stem in STEMS if stem.id == stem_id)


def get_modifier(modifier_id: ModifierId) -> Modifier:
    return next(modifier for modifier in MODIFIERS if modifier.id == modifier_id)


def inflect(surface: str, modifier_id: ModifierId, condition: Condition) -> str:
    if modifier_id == "bare":
        return surface

    modifier = get_modifier(modifier_id)
    if condition == "transparent":
        return f"{surface}{modifier.suffix}"

    stem = get_stem(surface)
    if stem.final_class == "consonant":
        return f"{surface}{modifier.suffix}"

    truncated = surface[:-1]
    if modifier_id == "mod_a":
        return f"{truncated}ka"
    return f"{truncated}nu"


def referent_id(stem_id: str, modifier_id: ModifierId) -> str:
    if modifier_id == "bare":
        return stem_id
    return f"{stem_id}_{modifier_id}"


def build_referents() -> list[Referent]:
    referents: list[Referent] = []
    for stem in STEMS:
        for modifier in MODIFIERS:
            rid = referent_id(stem.id, modifier.id)
            referents.append(
                Referent(
                    id=rid,
                    stem_id=stem.id,
                    modifier_id=modifier.id,
                    label=f"{stem.label} {modifier.label}".strip(),
                    image_filename=f"{rid}.svg",
                    audio_id=rid,
                )
            )
    return referents


def word_for_referent(referent: Referent, condition: Condition) -> str:
    return inflect(referent.stem_id, referent.modifier_id, condition)


def build_manifest(asset_prefix: str = "/study-assets") -> dict:
    referents = []
    for referent in build_referents():
        referents.append(
            {
                "id": referent.id,
                "stemId": referent.stem_id,
                "modifierId": referent.modifier_id,
                "imageUrl": f"{asset_prefix}/referents/{referent.image_filename}",
                "audio": {
                    "transparent": f"{asset_prefix}/audio/transparent/{referent.audio_id}.wav",
                    "opaque": f"{asset_prefix}/audio/opaque/{referent.audio_id}.wav",
                },
                "surfaceForms": {
                    "transparent": word_for_referent(referent, "transparent"),
                    "opaque": word_for_referent(referent, "opaque"),
                },
            }
        )

    primitives = [
        {
            "id": primitive.id,
            "category": primitive.category,
            "label": primitive.label,
            "svgUrl": f"{asset_prefix}/primitives/{primitive.filename}",
        }
        for primitive in PRIMITIVES
    ]

    stems = [
        {
            "id": stem.id,
            "surface": stem.surface,
            "label": stem.label,
            "finalClass": stem.final_class,
            "shapeId": stem.shape_id,
        }
        for stem in STEMS
    ]
    modifiers = [
        {
            "id": modifier.id,
            "label": modifier.label,
            "suffix": modifier.suffix,
            "variant": modifier.variant,
            "description": modifier.description,
        }
        for modifier in MODIFIERS
    ]
    return {"stems": stems, "modifiers": modifiers, "primitives": primitives, "referents": referents}
