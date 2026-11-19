import { describe, expect, it } from "vitest";
import { clampInterval, FREQS, loopNote, NOTES, PRESETS } from "./melodies";

describe("melodies", () => {
  it("presets only use valid notes and have unique ids", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) {
      expect(p.notes.length).toBeGreaterThan(1);
      p.notes.forEach((n) => expect(n >= 0 && n < NOTES.length && Number.isInteger(n)).toBe(true));
    }
    expect(FREQS).toHaveLength(NOTES.length);
  });
  it("frequencies ascend", () => {
    FREQS.forEach((f, i) => i && expect(f).toBeGreaterThan(FREQS[i - 1]));
  });
  it("clamps tempo", () => {
    expect(clampInterval(5)).toBe(60);
    expect(clampInterval(99999)).toBe(2000);
    expect(clampInterval(NaN)).toBe(350);
    expect(clampInterval(350.4)).toBe(350);
  });
  it("loops notes", () => {
    expect(loopNote([1, 2, 3], 4)).toBe(2);
  });
});
