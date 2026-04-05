"""Wraps the existing static referent set as a domain."""
from __future__ import annotations

from pathlib import Path

from app.core.domains import GeneratedReferent, ReferentDomain
from app.core.config import get_settings


class ObjectsDomain(ReferentDomain):
    domain_id = "objects"

    def library(self) -> list[GeneratedReferent]:
        from app.core.stimuli import STEMS, MODIFIERS, referent_id

        assets_dir = get_settings().assets_dir
        referents: list[GeneratedReferent] = []
        for stem in STEMS:
            for modifier in MODIFIERS:
                rid = referent_id(stem.id, modifier.id)
                svg_path = assets_dir / "referents" / f"{rid}.svg"
                svg = svg_path.read_text() if svg_path.exists() else _placeholder_svg(rid)
                referents.append(GeneratedReferent(
                    id=rid,
                    label=f"{stem.label} {modifier.label}".strip(),
                    group=stem.id,
                    variant=modifier.id,
                    program={"type": "static", "stem": stem.id, "modifier": modifier.id},
                    svg=svg,
                ))
        return referents

    def render_svg(self, program: dict) -> str:
        from app.core.stimuli import referent_id
        assets_dir = get_settings().assets_dir
        rid = referent_id(program["stem"], program["modifier"])
        svg_path = assets_dir / "referents" / f"{rid}.svg"
        return svg_path.read_text() if svg_path.exists() else _placeholder_svg(rid)


def _placeholder_svg(label: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">'
        '<rect width="128" height="128" fill="#f7f7f7"/>'
        f'<text x="64" y="68" text-anchor="middle" font-size="12" fill="#999">{label}</text>'
        '</svg>'
    )
