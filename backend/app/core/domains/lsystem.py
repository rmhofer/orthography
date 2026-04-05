"""L-System (Lindenmayer system) domain — grammar-driven fractal/plant structures."""
from __future__ import annotations

import math
from app.core.domains import GeneratedReferent, ReferentDomain

SVG_SIZE = 128
MARGIN = 10


class LSystemDomain(ReferentDomain):
    domain_id = "lsystem"

    def library(self) -> list[GeneratedReferent]:
        return _LIBRARY

    def render_svg(self, program: dict) -> str:
        return _render(program)


# ── L-System expansion ─────────────────────────────────

def _expand(axiom: str, rules: dict[str, str], iterations: int) -> str:
    s = axiom
    for _ in range(iterations):
        s = "".join(rules.get(c, c) for c in s)
    return s


def _interpret(string: str, angle_deg: float, step: float = 5.0) -> list[tuple[float, float, float, float]]:
    """Turtle-interpret an L-system string. F=forward, +=turn right, -=turn left, [=push, ]=pop."""
    x, y, heading = 0.0, 0.0, -90.0
    stack: list[tuple[float, float, float]] = []
    lines: list[tuple[float, float, float, float]] = []
    for c in string:
        if c == "F":
            rad = math.radians(heading)
            nx = x + step * math.cos(rad)
            ny = y + step * math.sin(rad)
            lines.append((x, y, nx, ny))
            x, y = nx, ny
        elif c == "+":
            heading += angle_deg
        elif c == "-":
            heading -= angle_deg
        elif c == "[":
            stack.append((x, y, heading))
        elif c == "]" and stack:
            x, y, heading = stack.pop()
    return lines


def _render(program: dict) -> str:
    string = _expand(program["axiom"], program.get("rules", {}), program.get("iterations", 3))
    lines = _interpret(string, program.get("angle", 25), program.get("step", 5))
    if not lines:
        return _empty_svg()
    all_x = [v for seg in lines for v in (seg[0], seg[2])]
    all_y = [v for seg in lines for v in (seg[1], seg[3])]
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)
    w = max_x - min_x or 1
    h = max_y - min_y or 1
    scale = (SVG_SIZE - 2 * MARGIN) / max(w, h)
    ox = MARGIN + ((SVG_SIZE - 2 * MARGIN) - w * scale) / 2 - min_x * scale
    oy = MARGIN + ((SVG_SIZE - 2 * MARGIN) - h * scale) / 2 - min_y * scale

    parts = []
    for x1, y1, x2, y2 in lines:
        parts.append(f"M{x1 * scale + ox:.1f} {y1 * scale + oy:.1f}L{x2 * scale + ox:.1f} {y2 * scale + oy:.1f}")
    d = "".join(parts)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_SIZE}" height="{SVG_SIZE}" viewBox="0 0 {SVG_SIZE} {SVG_SIZE}">'
        f'<rect width="{SVG_SIZE}" height="{SVG_SIZE}" fill="#f7f7f7" rx="8"/>'
        f'<path d="{d}" fill="none" stroke="#121212" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
        '</svg>'
    )


def _empty_svg() -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_SIZE}" height="{SVG_SIZE}"><rect width="{SVG_SIZE}" height="{SVG_SIZE}" fill="#f7f7f7" rx="8"/></svg>'


# ── Fixed library ──────────────────────────────────────

_SPECS: list[tuple[str, str, str, dict]] = []

# Tree family
_TREE_RULES = [
    ("tree_a", {"F": "F[+F]F[-F]F"}, 25),
    ("tree_b", {"F": "F[+F][-F]F"}, 20),
    ("tree_c", {"F": "FF+[+F-F-F]-[-F+F+F]"}, 22),
    ("tree_d", {"F": "F[+F]F[-F][F]"}, 30),
]
for tid, rules, angle in _TREE_RULES:
    for iters in [2, 3, 4]:
        _SPECS.append((
            f"{tid}_i{iters}", f"{tid} depth {iters}", "tree",
            {"axiom": "F", "rules": rules, "angle": angle, "iterations": iters},
        ))

# Koch family
_KOCH_RULES = [
    ("koch", {"F": "F+F-F-F+F"}, 90),
    ("koch_tri", {"F": "F-F+F"}, 120),
    ("snowflake", {"F": "F+F--F+F"}, 60),
]
for kid, rules, angle in _KOCH_RULES:
    for iters in [2, 3, 4]:
        _SPECS.append((
            f"{kid}_i{iters}", f"{kid} depth {iters}", "koch",
            {"axiom": "F", "rules": rules, "angle": angle, "iterations": iters},
        ))

# Dragon curve family
_SPECS.append(("dragon_3", "dragon depth 3", "dragon", {"axiom": "FX", "rules": {"X": "X+YF+", "Y": "-FX-Y"}, "angle": 90, "iterations": 8}))
_SPECS.append(("dragon_2", "dragon depth 2", "dragon", {"axiom": "FX", "rules": {"X": "X+YF+", "Y": "-FX-Y"}, "angle": 90, "iterations": 6}))

# Sierpinski
_SPECS.append(("sierpinski_3", "sierpinski 3", "sierpinski", {"axiom": "F-G-G", "rules": {"F": "F-G+F+G-F", "G": "GG"}, "angle": 120, "iterations": 4}))
_SPECS.append(("sierpinski_4", "sierpinski 4", "sierpinski", {"axiom": "F-G-G", "rules": {"F": "F-G+F+G-F", "G": "GG"}, "angle": 120, "iterations": 5}))

# Hilbert
_SPECS.append(("hilbert_2", "hilbert 2", "hilbert", {"axiom": "A", "rules": {"A": "-BF+AFA+FB-", "B": "+AF-BFB-FA+"}, "angle": 90, "iterations": 3}))
_SPECS.append(("hilbert_3", "hilbert 3", "hilbert", {"axiom": "A", "rules": {"A": "-BF+AFA+FB-", "B": "+AF-BFB-FA+"}, "angle": 90, "iterations": 4}))

# Bush variants
for angle in [20, 25, 35, 45]:
    _SPECS.append((
        f"bush_{angle}", f"bush {angle}°", "bush",
        {"axiom": "F", "rules": {"F": "FF-[-F+F+F]+[+F-F-F]"}, "angle": angle, "iterations": 3},
    ))

_LIBRARY = [
    GeneratedReferent(
        id=sid, label=label, group=group, variant=f"v{i % 3}",
        program=prog, svg=_render(prog),
    )
    for i, (sid, label, group, prog) in enumerate(_SPECS)
]
