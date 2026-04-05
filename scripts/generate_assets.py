from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import textwrap
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "backend"))

from app.core.stimuli import PRIMITIVES, STEMS, MODIFIERS, build_manifest, build_referents, word_for_referent  # noqa: E402


PRIMITIVE_SVGS = {
    "stroke_bar": '<line x1="12" y1="32" x2="52" y2="32" />',
    "stroke_pillar": '<line x1="32" y1="10" x2="32" y2="54" />',
    "stroke_slash": '<line x1="16" y1="52" x2="48" y2="12" />',
    "stroke_hook": '<path d="M16 14 C40 14, 44 34, 28 42 C24 44, 22 48, 22 52" />',
    "enclosure_square": '<rect x="14" y="14" width="36" height="36" rx="4" />',
    "enclosure_circle": '<circle cx="32" cy="32" r="19" />',
    "enclosure_triangle": '<path d="M32 11 L52 49 L12 49 Z" />',
    "enclosure_halfbox": '<path d="M14 16 H50 V48 H30" />',
    "complex_cross": '<path d="M32 12 V52 M12 32 H52" />',
    "complex_dots": '<circle cx="20" cy="22" r="4" /><circle cx="40" cy="20" r="4" /><circle cx="30" cy="40" r="4" />',
    "complex_zigzag": '<path d="M12 18 L24 30 L36 18 L48 30 L52 46" />',
    "complex_spiral": '<path d="M35 18 C25 14, 17 22, 18 31 C19 43, 33 46, 39 36 C43 29, 39 22, 31 23 C25 24, 24 31, 28 34" />',
    "decorator_tick": '<path d="M18 32 L28 42 L46 18" />',
    "decorator_wave": '<path d="M12 36 C18 26, 26 46, 34 30 C40 20, 46 34, 52 26" />',
    "decorator_arrow": '<path d="M14 32 H46 M36 22 L50 32 L36 42" />',
    "decorator_ring": '<circle cx="32" cy="32" r="16" /><circle cx="32" cy="32" r="8" />',
}

SHAPE_PATHS = {
    "orbital": '<circle cx="64" cy="64" r="26" /><circle cx="64" cy="64" r="10" fill="#FAF8F5" stroke="none" /><path d="M20 64 C32 38, 96 38, 108 64 C96 90, 32 90, 20 64 Z" fill="none" />',
    "spire": '<path d="M64 18 L102 88 L64 110 L26 88 Z" /><path d="M64 28 L84 84 L64 98 L44 84 Z" fill="#FAF8F5" stroke="none" />',
    "kite": '<path d="M64 16 L100 54 L64 112 L28 54 Z" /><path d="M64 32 L78 54 L64 92 L50 54 Z" fill="#FAF8F5" stroke="none" />',
    "crest": '<path d="M22 78 C28 34, 100 34, 106 78" /><path d="M28 78 L44 48 L64 76 L84 48 L100 78 Z" />',
    "petal": '<path d="M64 18 C82 26, 88 48, 64 62 C40 48, 46 26, 64 18 Z" /><path d="M26 64 C34 46, 56 40, 70 64 C56 88, 34 82, 26 64 Z" /><path d="M102 64 C94 46, 72 40, 58 64 C72 88, 94 82, 102 64 Z" /><path d="M64 110 C46 102, 40 80, 64 66 C88 80, 82 102, 64 110 Z" />',
    "star": '<path d="M64 18 L74 48 L106 48 L80 66 L90 98 L64 78 L38 98 L48 66 L22 48 L54 48 Z" />',
    "arch": '<path d="M26 96 V62 C26 34, 44 18, 64 18 C84 18, 102 34, 102 62 V96" /><path d="M46 96 V64 C46 48, 54 38, 64 38 C74 38, 82 48, 82 64 V96" fill="#FAF8F5" stroke="none" />',
    "drop": '<path d="M64 18 C48 38, 34 54, 34 74 C34 92, 48 110, 64 110 C80 110, 94 92, 94 74 C94 54, 80 38, 64 18 Z" /><circle cx="64" cy="74" r="12" fill="#FAF8F5" stroke="none" />',
    "hex": '<path d="M40 20 H88 L112 64 L88 108 H40 L16 64 Z" /><path d="M50 40 H78 L92 64 L78 88 H50 L36 64 Z" fill="#FAF8F5" stroke="none" />',
    "spark": '<path d="M64 16 L74 44 L104 34 L84 58 L112 64 L84 70 L104 94 L74 84 L64 112 L54 84 L24 94 L44 70 L16 64 L44 58 L24 34 L54 44 Z" />',
}


def svg_wrapper(inner: str, fill: str = "#1A1A1A", stroke: str = "#1A1A1A", width: int = 64, height: int = 64) -> str:
    return textwrap.dedent(
        f"""\
        <svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 64 64" fill="none">
          <g stroke="{stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="{fill}">
            {inner}
          </g>
        </svg>
        """
    )


def referent_wrapper(inner: str, fill: str = "#2B2B2B", stroke: str = "#1A1A1A", width: int = 128, height: int = 128) -> str:
    return textwrap.dedent(
        f"""\
        <svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 128 128" fill="none">
          <rect x="4" y="4" width="120" height="120" rx="28" fill="#F5F0E8"/>
          <g stroke="{stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="{fill}">
            {inner}
          </g>
        </svg>
        """
    )


def write_primitives() -> None:
    out_dir = ROOT / "assets" / "primitives"
    out_dir.mkdir(parents=True, exist_ok=True)
    for primitive in PRIMITIVES:
        svg = svg_wrapper(PRIMITIVE_SVGS[primitive.id])
        (out_dir / primitive.filename).write_text(svg, encoding="utf-8")


def write_referents() -> None:
    out_dir = ROOT / "assets" / "referents"
    out_dir.mkdir(parents=True, exist_ok=True)
    for stem in STEMS:
        base_inner = SHAPE_PATHS[stem.shape_id]
        for modifier in MODIFIERS:
            scale = "scale(1.0)" if modifier.variant != "large" else "translate(-10 -10) scale(1.18)"
            fill = "#D94A44" if modifier.variant == "red" else "#2B2B2B"
            inner = f'<g transform="{scale}">{base_inner}</g>'
            svg = referent_wrapper(inner, fill=fill)
            filename = f"{stem.id if modifier.id == 'bare' else f'{stem.id}_{modifier.id}'}.svg"
            (out_dir / filename).write_text(svg, encoding="utf-8")


def write_silence_placeholder(path: Path) -> None:
    with wave.open(str(path), "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(22050)
        handle.writeframes(b"\x00\x00" * 22050)


def generate_audio_file(text: str, destination: Path, voice: str = "Samantha") -> None:
    temp_aiff = destination.with_suffix(".aiff")
    try:
        subprocess.run(["say", "-v", voice, "-r", "178", "-o", str(temp_aiff), text], check=True, capture_output=True)
        subprocess.run(
            ["afconvert", "-f", "WAVE", "-d", "LEI16@22050", str(temp_aiff), str(destination)],
            check=True,
            capture_output=True,
        )
    except Exception:
        write_silence_placeholder(destination)
    finally:
        if temp_aiff.exists():
            temp_aiff.unlink()


def write_audio() -> None:
    referents = build_referents()
    for condition in ["transparent", "opaque"]:
        out_dir = ROOT / "assets" / "audio" / condition
        out_dir.mkdir(parents=True, exist_ok=True)
        for referent in referents:
            text = word_for_referent(referent, condition)  # type: ignore[arg-type]
            generate_audio_file(text, out_dir / f"{referent.audio_id}.wav")


def write_manifest() -> None:
    manifest = build_manifest()
    out_dir = ROOT / "assets" / "manifests"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "stimuli-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> None:
    write_primitives()
    write_referents()
    write_audio()
    write_manifest()


if __name__ == "__main__":
    main()
