from __future__ import annotations

import base64
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(frozen=True)
class GeneratedReferent:
    id: str
    label: str
    group: str       # grouping key for choice sets (analogous to stem_id)
    variant: str     # variant within group (analogous to modifier)
    program: dict    # JSON-serializable DSL program spec
    svg: str         # rendered SVG string


class ReferentDomain(ABC):
    domain_id: str = ""

    @abstractmethod
    def library(self) -> list[GeneratedReferent]:
        """Return the pre-built fixed library of referents."""

    def generate(self, seed: str, count: int) -> list[GeneratedReferent]:
        """Generate a seeded referent set. Default: sample from library."""
        import hashlib
        import random as _random

        rng = _random.Random(hashlib.sha256(seed.encode()).hexdigest())
        lib = self.library()
        return rng.sample(lib, min(count, len(lib)))

    @abstractmethod
    def render_svg(self, program: dict) -> str:
        """Render a single program spec to an SVG string."""

    def groups(self) -> list[str]:
        """Return unique group IDs from the library."""
        return sorted({r.group for r in self.library()})

    def variants(self) -> list[str]:
        """Return unique variant IDs from the library."""
        return sorted({r.variant for r in self.library()})


def svg_to_data_uri(svg: str) -> str:
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


# ── Domain registry ────────────────────────────────────

_REGISTRY: dict[str, ReferentDomain] = {}


def register_domain(domain: ReferentDomain) -> None:
    _REGISTRY[domain.domain_id] = domain


def get_domain(domain_id: str) -> ReferentDomain:
    if domain_id not in _REGISTRY:
        _load_all()
    return _REGISTRY[domain_id]


def list_domains() -> list[str]:
    _load_all()
    return list(_REGISTRY.keys())


def _load_all() -> None:
    if _REGISTRY:
        return
    from app.core.domains.objects import ObjectsDomain
    from app.core.domains.logo import LogoDomain
    from app.core.domains.lsystem import LSystemDomain
    from app.core.domains.shapes import ShapesDomain
    from app.core.domains.grid import GridDomain

    for cls in [ObjectsDomain, LogoDomain, LSystemDomain, ShapesDomain, GridDomain]:
        domain = cls()
        register_domain(domain)
