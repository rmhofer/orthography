"""Shape Scenes (CSG) domain — composed geometric primitives with spatial operators."""
from __future__ import annotations

from app.core.domains import GeneratedReferent, ReferentDomain

SVG_SIZE = 128
CX, CY = SVG_SIZE / 2, SVG_SIZE / 2


class ShapesDomain(ReferentDomain):
    domain_id = "shapes"

    def library(self) -> list[GeneratedReferent]:
        return _LIBRARY

    def render_svg(self, program: dict) -> str:
        return _render(program)


# ── Recursive SVG renderer ─────────────────────────────

def _render_node(node: dict) -> str:
    t = node["type"]
    fill = node.get("fill", "none")
    stroke = node.get("stroke", "#121212")
    sw = node.get("strokeWidth", 2.5)

    if t == "circle":
        r = node["r"]
        return f'<circle cx="0" cy="0" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'

    if t == "square":
        s = node["s"]
        return f'<rect x="{-s/2}" y="{-s/2}" width="{s}" height="{s}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'

    if t == "triangle":
        s = node["s"]
        h = s * 0.866
        pts = f"0,{-h*2/3} {-s/2},{h/3} {s/2},{h/3}"
        return f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'

    if t == "line":
        length = node["len"]
        return f'<line x1="{-length/2}" y1="0" x2="{length/2}" y2="0" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round"/>'

    if t == "translate":
        dx, dy = node["dx"], node["dy"]
        child = _render_node(node["child"])
        return f'<g transform="translate({dx},{dy})">{child}</g>'

    if t == "rotate":
        a = node["a"]
        child = _render_node(node["child"])
        return f'<g transform="rotate({a})">{child}</g>'

    if t == "scale":
        f = node["f"]
        child = _render_node(node["child"])
        return f'<g transform="scale({f})">{child}</g>'

    if t == "group":
        children = "".join(_render_node(c) for c in node["children"])
        return f'<g>{children}</g>'

    return ""


def _render(program: dict) -> str:
    inner = _render_node(program)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_SIZE}" height="{SVG_SIZE}" viewBox="0 0 {SVG_SIZE} {SVG_SIZE}">'
        f'<rect width="{SVG_SIZE}" height="{SVG_SIZE}" fill="#f7f7f7" rx="8"/>'
        f'<g transform="translate({CX},{CY})">{inner}</g>'
        '</svg>'
    )


# ── Fixed library ──────────────────────────────────────

def _c(r: float, **kw: object) -> dict:
    return {"type": "circle", "r": r, **kw}

def _sq(s: float, **kw: object) -> dict:
    return {"type": "square", "s": s, **kw}

def _tri(s: float, **kw: object) -> dict:
    return {"type": "triangle", "s": s, **kw}

def _ln(length: float) -> dict:
    return {"type": "line", "len": length}

def _tr(dx: float, dy: float, child: dict) -> dict:
    return {"type": "translate", "dx": dx, "dy": dy, "child": child}

def _rot(a: float, child: dict) -> dict:
    return {"type": "rotate", "a": a, "child": child}

def _sc(f: float, child: dict) -> dict:
    return {"type": "scale", "f": f, "child": child}

def _grp(*children: dict) -> dict:
    return {"type": "group", "children": list(children)}


_SPECS: list[tuple[str, str, str, dict]] = [
    # Singletons
    ("s_circle", "circle", "single", _c(30)),
    ("s_square", "square", "single", _sq(50)),
    ("s_triangle", "triangle", "single", _tri(55)),
    ("s_circle_sm", "small circle", "single", _c(18)),
    ("s_square_sm", "small square", "single", _sq(30)),

    # Pairs
    ("p_cc", "two circles", "pair", _grp(_tr(-20, 0, _c(15)), _tr(20, 0, _c(15)))),
    ("p_cs", "circle+square", "pair", _grp(_tr(-20, 0, _c(15)), _tr(20, 0, _sq(25)))),
    ("p_ct", "circle+triangle", "pair", _grp(_tr(-20, 0, _c(15)), _tr(22, 0, _tri(30)))),
    ("p_ss", "two squares", "pair", _grp(_tr(-22, 0, _sq(28)), _tr(22, 0, _sq(28)))),
    ("p_st", "square+triangle", "pair", _grp(_tr(-20, 0, _sq(28)), _tr(22, 0, _tri(32)))),
    ("p_tt", "two triangles", "pair", _grp(_tr(-22, 0, _tri(30)), _tr(22, 0, _tri(30)))),

    # Nested
    ("n_cs", "circle in square", "nested", _grp(_sq(48), _c(18))),
    ("n_sc", "square in circle", "nested", _grp(_c(30), _sq(30))),
    ("n_tc", "triangle in circle", "nested", _grp(_c(32), _tri(38))),
    ("n_ct", "circle in triangle", "nested", _grp(_tri(55), _c(16))),
    ("n_cc", "circle in circle", "nested", _grp(_c(30), _c(14))),
    ("n_ss", "square in square", "nested", _grp(_sq(48), _sq(26))),

    # Stacked (vertical)
    ("v_cc", "stacked circles", "stacked", _grp(_tr(0, -18, _c(14)), _tr(0, 18, _c(14)))),
    ("v_cs", "circle over square", "stacked", _grp(_tr(0, -18, _c(14)), _tr(0, 18, _sq(24)))),
    ("v_sc", "square over circle", "stacked", _grp(_tr(0, -18, _sq(24)), _tr(0, 18, _c(14)))),
    ("v_ccc", "three circles", "stacked", _grp(_tr(0, -24, _c(10)), _tr(0, 0, _c(10)), _tr(0, 24, _c(10)))),

    # Rotated
    ("r_sq45", "rotated square", "rotated", _rot(45, _sq(40))),
    ("r_tri30", "rotated triangle", "rotated", _rot(30, _tri(50))),
    ("r_pair", "rotated pair", "rotated", _rot(45, _grp(_tr(-16, 0, _c(12)), _tr(16, 0, _sq(20))))),

    # Compound (3+ shapes)
    ("c_face", "face", "compound", _grp(_c(35), _tr(-12, -8, _c(5)), _tr(12, -8, _c(5)), _tr(0, 12, _ln(16)))),
    ("c_house", "house", "compound", _grp(_tr(0, 10, _sq(40)), _tr(0, -18, _tri(48)))),
    ("c_target", "target", "compound", _grp(_c(30), _c(20), _c(10))),
    ("c_cross", "cross", "compound", _grp(_sq(14), _tr(0, -20, _sq(14)), _tr(0, 20, _sq(14)), _tr(-20, 0, _sq(14)), _tr(20, 0, _sq(14)))),
    ("c_diamond", "diamond pair", "compound", _grp(_rot(45, _sq(28)), _rot(45, _sq(16)))),

    # Scaled variants
    ("sc_big_c", "big circle", "scaled", _sc(1.4, _c(25))),
    ("sc_tiny_s", "tiny square", "scaled", _sc(0.6, _sq(40))),
    ("sc_big_t", "big triangle", "scaled", _sc(1.3, _tri(40))),
]

_LIBRARY = [
    GeneratedReferent(
        id=sid, label=label, group=group, variant=f"v{i % 3}",
        program=prog, svg=_render(prog),
    )
    for i, (sid, label, group, prog) in enumerate(_SPECS)
]
