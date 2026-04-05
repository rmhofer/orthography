"""Grid pattern DSL domain — compositional 2D patterns on an 8×8 grid."""
from __future__ import annotations

from app.core.domains import GeneratedReferent, ReferentDomain

SVG_SIZE = 128
GRID_N = 8
MARGIN = 8
CELL = (SVG_SIZE - 2 * MARGIN) / GRID_N


class GridDomain(ReferentDomain):
    domain_id = "grid"

    def library(self) -> list[GeneratedReferent]:
        return _LIBRARY

    def render_svg(self, program: dict) -> str:
        return _render(program)


# ── Pattern evaluator → 8×8 boolean grid ───────────────

Grid = list[list[bool]]


def _empty_grid() -> Grid:
    return [[False] * GRID_N for _ in range(GRID_N)]


def _eval_pattern(node: dict) -> Grid:
    t = node["type"]

    if t == "fill":
        return [[True] * GRID_N for _ in range(GRID_N)]

    if t == "stripe":
        n = node["n"]  # number of stripes
        d = node.get("dir", "horiz")
        g = _empty_grid()
        for r in range(GRID_N):
            for c in range(GRID_N):
                coord = r if d == "horiz" else c
                band = (coord * n) // GRID_N
                g[r][c] = band % 2 == 0
        return g

    if t == "checker":
        n = node.get("n", 1)
        g = _empty_grid()
        for r in range(GRID_N):
            for c in range(GRID_N):
                br = (r * n) // GRID_N
                bc = (c * n) // GRID_N
                g[r][c] = (br + bc) % 2 == 0
        return g

    if t == "border":
        w = node.get("width", 1)
        g = _empty_grid()
        for r in range(GRID_N):
            for c in range(GRID_N):
                g[r][c] = r < w or r >= GRID_N - w or c < w or c >= GRID_N - w
        return g

    if t == "diagonal":
        d = node.get("dir", "right")  # "right" = top-left to bottom-right
        w = node.get("width", 1)
        g = _empty_grid()
        for r in range(GRID_N):
            for c in range(GRID_N):
                diff = (r - c) if d == "right" else (r - (GRID_N - 1 - c))
                g[r][c] = abs(diff) < w
        return g

    if t == "quadrant":
        tl = _eval_pattern(node["tl"])
        tr = _eval_pattern(node["tr"])
        bl = _eval_pattern(node["bl"])
        br = _eval_pattern(node["br"])
        g = _empty_grid()
        half = GRID_N // 2
        for r in range(GRID_N):
            for c in range(GRID_N):
                sr, sc = r % half, c % half
                if r < half and c < half:
                    g[r][c] = tl[sr][sc]
                elif r < half:
                    g[r][c] = tr[sr][sc]
                elif c < half:
                    g[r][c] = bl[sr][sc]
                else:
                    g[r][c] = br[sr][sc]
        return g

    if t == "overlay":
        base = _eval_pattern(node["base"])
        top = _eval_pattern(node["top"])
        mode = node.get("mode", "xor")
        g = _empty_grid()
        for r in range(GRID_N):
            for c in range(GRID_N):
                if mode == "xor":
                    g[r][c] = base[r][c] ^ top[r][c]
                elif mode == "or":
                    g[r][c] = base[r][c] or top[r][c]
                elif mode == "and":
                    g[r][c] = base[r][c] and top[r][c]
        return g

    if t == "invert":
        inner = _eval_pattern(node["inner"])
        return [[not inner[r][c] for c in range(GRID_N)] for r in range(GRID_N)]

    return _empty_grid()


# ── SVG renderer ───────────────────────────────────────

def _render(program: dict) -> str:
    grid = _eval_pattern(program)
    rects = []
    for r in range(GRID_N):
        for c in range(GRID_N):
            x = MARGIN + c * CELL
            y = MARGIN + r * CELL
            fill = "#121212" if grid[r][c] else "#f0f0f0"
            rects.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{CELL:.1f}" height="{CELL:.1f}" fill="{fill}" stroke="#e0e0e0" stroke-width="0.5"/>')
    cells = "".join(rects)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_SIZE}" height="{SVG_SIZE}" viewBox="0 0 {SVG_SIZE} {SVG_SIZE}">'
        f'<rect width="{SVG_SIZE}" height="{SVG_SIZE}" fill="#f7f7f7" rx="8"/>'
        f'{cells}'
        '</svg>'
    )


# ── Fixed library ──────────────────────────────────────

def _stripe(n: int, d: str = "horiz") -> dict:
    return {"type": "stripe", "n": n, "dir": d}

def _checker(n: int = 1) -> dict:
    return {"type": "checker", "n": n}

def _border(w: int = 1) -> dict:
    return {"type": "border", "width": w}

def _diag(d: str = "right", w: int = 1) -> dict:
    return {"type": "diagonal", "dir": d, "width": w}

def _quad(tl: dict, tr: dict, bl: dict, br: dict) -> dict:
    return {"type": "quadrant", "tl": tl, "tr": tr, "bl": bl, "br": br}

def _overlay(base: dict, top: dict, mode: str = "xor") -> dict:
    return {"type": "overlay", "base": base, "top": top, "mode": mode}

def _invert(inner: dict) -> dict:
    return {"type": "invert", "inner": inner}

_fill = {"type": "fill"}
_empty = {"type": "checker", "n": 0}  # produces all-false since n=0

_SPECS: list[tuple[str, str, str, dict]] = [
    # Stripes
    ("h2", "2 horiz stripes", "stripe", _stripe(2)),
    ("h4", "4 horiz stripes", "stripe", _stripe(4)),
    ("v2", "2 vert stripes", "stripe", _stripe(2, "vert")),
    ("v4", "4 vert stripes", "stripe", _stripe(4, "vert")),
    ("h3", "3 horiz stripes", "stripe", _stripe(3)),
    ("v3", "3 vert stripes", "stripe", _stripe(3, "vert")),

    # Checkers
    ("ck1", "checker 1", "checker", _checker(1)),
    ("ck2", "checker 2", "checker", _checker(2)),
    ("ck4", "checker 4", "checker", _checker(4)),

    # Borders
    ("b1", "border 1", "border", _border(1)),
    ("b2", "border 2", "border", _border(2)),

    # Diagonals
    ("dr1", "diag right", "diagonal", _diag("right", 1)),
    ("dl1", "diag left", "diagonal", _diag("left", 1)),
    ("dr2", "thick diag right", "diagonal", _diag("right", 2)),
    ("dx", "cross diag", "diagonal", _overlay(_diag("right", 1), _diag("left", 1), "or")),

    # Overlays
    ("oh_ck", "horiz+checker", "overlay", _overlay(_stripe(2), _checker(2))),
    ("ov_ck", "vert+checker", "overlay", _overlay(_stripe(2, "vert"), _checker(2))),
    ("hv", "horiz+vert", "overlay", _overlay(_stripe(4), _stripe(4, "vert"))),
    ("b_ck", "border+checker", "overlay", _overlay(_border(1), _checker(2))),
    ("b_h", "border+horiz", "overlay", _overlay(_border(1), _stripe(4))),

    # Inverted
    ("inv_ck", "inverted checker", "inverted", _invert(_checker(2))),
    ("inv_h", "inverted horiz", "inverted", _invert(_stripe(2))),
    ("inv_b", "inverted border", "inverted", _invert(_border(1))),

    # Quadrants
    ("q_fill", "quad fill pattern", "quadrant", _quad(_fill, _checker(1), _checker(1), _fill)),
    ("q_stripe", "quad stripe mix", "quadrant", _quad(_stripe(2), _stripe(2, "vert"), _stripe(2, "vert"), _stripe(2))),
    ("q_checker", "quad checker mix", "quadrant", _quad(_checker(2), _fill, _fill, _checker(2))),
    ("q_mixed", "quad mixed", "quadrant", _quad(_border(1), _checker(1), _stripe(2), _diag("right", 1))),
    ("q_tri", "quad triangular", "quadrant", _quad(_fill, _checker(2), _border(1), _stripe(2, "vert"))),

    # Complex composites
    ("cx_1", "border+diag+checker", "complex", _overlay(_overlay(_border(1), _diag("right", 1)), _checker(4))),
    ("cx_2", "stripe cross", "complex", _overlay(_stripe(3), _stripe(3, "vert"), "and")),
]

_LIBRARY = [
    GeneratedReferent(
        id=sid, label=label, group=group, variant=f"v{i % 3}",
        program=prog, svg=_render(prog),
    )
    for i, (sid, label, group, prog) in enumerate(_SPECS)
]
