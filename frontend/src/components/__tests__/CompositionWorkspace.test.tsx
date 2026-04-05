import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompositionWorkspace } from "../CompositionWorkspace";

const primitives = [
  { id: "stroke_bar", category: "stroke" as const, label: "Bar", svgUrl: "/study-assets/primitives/primitive-stroke-bar.svg" },
];

describe("CompositionWorkspace", () => {
  it("disables tray items once the primitive cap is reached", () => {
    const placedPrimitives = [
      {
        instanceId: "one",
        primitiveId: "stroke_bar",
        x: 20,
        y: 20,
        placementOrder: 1,
        createdAtMs: 1,
        updatedAtMs: 1,
      },
    ];

    render(<CompositionWorkspace primitives={primitives} placedPrimitives={placedPrimitives} maxPrimitives={1} />);
    expect(screen.getByRole("button", { name: /bar/i })).toBeDisabled();
  });
});
