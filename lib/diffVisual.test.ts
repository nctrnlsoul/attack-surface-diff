import { describe, expect, it } from "vitest";

import { elementVisual, type DiffFlags } from "./diffVisual.js";

const base: DiffFlags = {
  inBefore: false,
  inAfter: false,
  onActivePath: false,
  onAddedPath: false,
  onRemovedPath: false,
};

describe("elementVisual", () => {
  it("computes presence from the active side", () => {
    expect(elementVisual({ ...base, inBefore: true, inAfter: false }, "before").present).toBe(true);
    expect(elementVisual({ ...base, inBefore: true, inAfter: false }, "after").present).toBe(false);
  });

  // Scenario 3: the INTERNET -> db-sg edge leaves in "after" (removed + absent).
  it("fades green an element that is actually gone in after", () => {
    const v = elementVisual(
      { ...base, inBefore: true, inAfter: false, onRemovedPath: true },
      "after",
    );
    expect(v.present).toBe(false);
    expect(v.fadeGreen).toBe(true);
  });

  // Scenario 3: the db-sg -> rds edge is on the removed path but still present in
  // "after" — it must NOT fade green (the bug Brian saw was solid-green here).
  it("does NOT fade green an element on a removed path that still exists in after", () => {
    const v = elementVisual(
      { ...base, inBefore: true, inAfter: true, onRemovedPath: true },
      "after",
    );
    expect(v.present).toBe(true);
    expect(v.fadeGreen).toBe(false);
  });

  it("never fades green in the before state (removed paths are active threats there)", () => {
    const v = elementVisual(
      { ...base, inBefore: true, inAfter: false, onRemovedPath: true, onActivePath: true },
      "before",
    );
    expect(v.fadeGreen).toBe(false);
    expect(v.onPath).toBe(true);
  });

  it("glows a newly added path element that is present in after", () => {
    const v = elementVisual(
      { ...base, inBefore: true, inAfter: true, onAddedPath: true },
      "after",
    );
    expect(v.glow).toBe(true);
  });

  it("does not glow added elements in the before state", () => {
    const v = elementVisual({ ...base, inBefore: true, inAfter: true, onAddedPath: true }, "before");
    expect(v.glow).toBe(false);
  });
});
