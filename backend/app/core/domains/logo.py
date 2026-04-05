"""LOGO turtle graphics DSL domain."""
from __future__ import annotations

import math
from app.core.domains import GeneratedReferent, ReferentDomain

SVG_SIZE = 128
MARGIN = 12


class LogoDomain(ReferentDomain):
    domain_id = "logo"

    def library(self) -> list[GeneratedReferent]:
        return _LIBRARY

    def render_svg(self, program: dict) -> str:
        return _render(program)


# ── Turtle interpreter ─────────────────────────────────

def _execute(program: dict) -> list[tuple[float, float, float, float]]:
    """Execute a LOGO program, return list of (x1,y1,x2,y2) line segments."""
    state = {"x": 0.0, "y": 0.0, "heading": -90.0, "pen": True}
    lines: list[tuple[float, float, float, float]] = []

    def run(node: dict) -> None:
        t = node["type"]
        if t == "forward":
            d = node["d"]
            rad = math.radians(state["heading"])
            nx = state["x"] + d * math.cos(rad)
            ny = state["y"] + d * math.sin(rad)
            if state["pen"]:
                lines.append((state["x"], state["y"], nx, ny))
            state["x"], state["y"] = nx, ny
        elif t == "turn":
            state["heading"] = (state["heading"] + node["a"]) % 360
        elif t == "penup":
            state["pen"] = False
        elif t == "pendown":
            state["pen"] = True
        elif t == "repeat":
            for _ in range(node["n"]):
                for step in node["body"]:
                    run(step)
        elif t == "seq":
            for step in node["steps"]:
                run(step)

    run(program)
    return lines


def _render(program: dict) -> str:
    lines = _execute(program)
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

    path_parts = []
    for x1, y1, x2, y2 in lines:
        sx1, sy1 = x1 * scale + ox, y1 * scale + oy
        sx2, sy2 = x2 * scale + ox, y2 * scale + oy
        path_parts.append(f"M{sx1:.1f} {sy1:.1f}L{sx2:.1f} {sy2:.1f}")
    d = "".join(path_parts)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_SIZE}" height="{SVG_SIZE}" viewBox="0 0 {SVG_SIZE} {SVG_SIZE}">'
        f'<rect width="{SVG_SIZE}" height="{SVG_SIZE}" fill="#f7f7f7" rx="8"/>'
        f'<path d="{d}" fill="none" stroke="#121212" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
        '</svg>'
    )


def _empty_svg() -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_SIZE}" height="{SVG_SIZE}" viewBox="0 0 {SVG_SIZE} {SVG_SIZE}"><rect width="{SVG_SIZE}" height="{SVG_SIZE}" fill="#f7f7f7" rx="8"/></svg>'


# ── Fixed library ──────────────────────────────────────

def _poly(n: int, size: float = 40) -> dict:
    angle = 360 / n
    return {"type": "repeat", "n": n, "body": [{"type": "forward", "d": size}, {"type": "turn", "a": angle}]}

def _star(n: int, size: float = 40) -> dict:
    angle = 180 - 180 / n
    return {"type": "repeat", "n": n, "body": [{"type": "forward", "d": size}, {"type": "turn", "a": angle}]}

def _spiral(steps: int, d_start: float, d_inc: float, angle: float) -> dict:
    body = []
    d = d_start
    for _ in range(steps):
        body.append({"type": "forward", "d": d})
        body.append({"type": "turn", "a": angle})
        d += d_inc
    return {"type": "seq", "steps": body}

def _nested_poly(outer_n: int, inner_n: int, outer_size: float = 50, inner_size: float = 20) -> dict:
    inner = _poly(inner_n, inner_size)
    return {"type": "seq", "steps": [
        _poly(outer_n, outer_size),
        {"type": "penup"}, {"type": "forward", "d": outer_size * 0.3}, {"type": "pendown"},
        inner,
    ]}

_PROGRAMS: list[tuple[str, str, str, dict]] = []

# Polygons (group: polygon, variants: tri/quad/pent/hex/oct)
for n, name in [(3, "tri"), (4, "quad"), (5, "pent"), (6, "hex"), (8, "oct")]:
    _PROGRAMS.append((f"poly_{n}", f"{name}agon", "polygon", _poly(n)))
    _PROGRAMS.append((f"poly_{n}_sm", f"small {name}agon", "polygon", _poly(n, 25)))
    _PROGRAMS.append((f"poly_{n}_rot", f"rotated {name}agon", "polygon",
        {"type": "seq", "steps": [{"type": "turn", "a": 30}, _poly(n)]}))

# Stars
for n in [5, 6, 7, 8]:
    _PROGRAMS.append((f"star_{n}", f"{n}-star", "star", _star(n)))
    _PROGRAMS.append((f"star_{n}_sm", f"small {n}-star", "star", _star(n, 25)))

# Spirals
for angle in [90, 91, 120, 144]:
    _PROGRAMS.append((f"spiral_{angle}", f"spiral {angle}°", "spiral", _spiral(36, 2, 1.5, angle)))

# Nested shapes
for on, inn in [(4, 3), (5, 4), (6, 3), (3, 6), (8, 4)]:
    _PROGRAMS.append((f"nested_{on}_{inn}", f"nested {on}-{inn}", "compound", _nested_poly(on, inn)))

# Flower patterns (polygon rotated multiple times)
for n, reps in [(4, 6), (3, 8), (5, 5), (6, 4)]:
    steps = []
    for _ in range(reps):
        steps.append(_poly(n, 30))
        steps.append({"type": "turn", "a": 360 / reps})
    _PROGRAMS.append((f"flower_{n}_{reps}", f"flower {n}×{reps}", "compound",
        {"type": "seq", "steps": steps}))

_LIBRARY = [
    GeneratedReferent(
        id=pid, label=label, group=group, variant=f"v{i % 3}",
        program=prog, svg=_render(prog),
    )
    for i, (pid, label, group, prog) in enumerate(_PROGRAMS)
]
