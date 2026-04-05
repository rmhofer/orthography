from app.core.stimuli import build_manifest, build_referents, inflect


def test_opaque_inflection_truncates_vowel_stems() -> None:
    assert inflect("talu", "mod_a", "opaque") == "talka"
    assert inflect("talu", "mod_b", "opaque") == "talnu"
    assert inflect("rem", "mod_a", "opaque") == "remika"


def test_manifest_contains_expected_counts() -> None:
    manifest = build_manifest()
    assert len(manifest["primitives"]) == 20
    assert len(build_referents()) == 30
    assert len(manifest["referents"]) == 30
