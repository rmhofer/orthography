import { describe, expect, it } from "vitest";

import { buildNovelPrompts, buildRecognitionOptions, phaseRoute } from "../helpers";

const referents = [
  { id: "talu", stemId: "talu", modifierId: "bare", imageUrl: "", audio: { transparent: "", opaque: "" }, surfaceForms: { transparent: "talu", opaque: "talu" } },
  { id: "talu_mod_a", stemId: "talu", modifierId: "mod_a", imageUrl: "", audio: { transparent: "", opaque: "" }, surfaceForms: { transparent: "taluika", opaque: "talka" } },
  { id: "talu_mod_b", stemId: "talu", modifierId: "mod_b", imageUrl: "", audio: { transparent: "", opaque: "" }, surfaceForms: { transparent: "taluonu", opaque: "talnu" } },
  { id: "miso", stemId: "miso", modifierId: "bare", imageUrl: "", audio: { transparent: "", opaque: "" }, surfaceForms: { transparent: "miso", opaque: "miso" } },
  { id: "miso_mod_a", stemId: "miso", modifierId: "mod_a", imageUrl: "", audio: { transparent: "", opaque: "" }, surfaceForms: { transparent: "misoika", opaque: "miska" } },
  { id: "miso_mod_b", stemId: "miso", modifierId: "mod_b", imageUrl: "", audio: { transparent: "", opaque: "" }, surfaceForms: { transparent: "misoonu", opaque: "misnu" } },
];

describe("helpers", () => {
  it("maps phases to routes", () => {
    expect(phaseRoute("abc", "game")).toBe("/session/abc/game");
  });

  it("includes the target in recognition options", () => {
    const options = buildRecognitionOptions(referents as never, "talu_mod_a");
    expect(options).toContain("talu_mod_a");
  });

  it("creates two novel prompts", () => {
    const prompts = buildNovelPrompts(referents as never);
    expect(prompts).toHaveLength(2);
  });
});
