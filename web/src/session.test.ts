import { describe, expect, it } from "vitest";
import { describeSurprise, plotPoints, surpriseSvg } from "./plot";
import { Learner, Session } from "./session";

/** Fake learner: surprise is the number of symbols seen so far. */
function fake(vocab = 3): Learner {
  let n = 0;
  return {
    vocab,
    observe: () => ++n,
    probs: () => new Float32Array(vocab).fill(1 / vocab),
    resetContext: () => {},
    dream: (k) => Array(k).fill(1),
  };
}

describe("Session", () => {
  it("dreaming does not touch the history", () => {
    const s = new Session(() => fake());
    s.push(0);
    expect(s.dream(4)).toEqual([1, 1, 1, 1]);
    expect(s.history).toHaveLength(1);
  });

  it("starts empty, records steps, and resets on newSequence with a fresh model", () => {
    const s = new Session(() => fake());
    expect(s.isEmpty).toBe(true);
    expect(s.push(0)).toBe(1);
    expect(s.push(2)).toBe(2);
    expect(s.history).toEqual([
      { sym: 0, surprise: 1 },
      { sym: 2, surprise: 2 },
    ]);
    expect(s.recentMean(1)).toBe(2);
    s.newSequence();
    expect(s.isEmpty).toBe(true);
    expect(s.push(1)).toBe(1); // new model, counter restarted
  });

  it("caps history length", () => {
    const s = new Session(() => fake(), 3);
    for (let i = 0; i < 5; i++) s.push(0);
    expect(s.history.map((x) => x.surprise)).toEqual([3, 4, 5]);
  });
});

describe("plot", () => {
  it("maps values into the box, high surprise at the top", () => {
    const pts = plotPoints([0, 2], { width: 100, height: 100, yMax: 2 });
    expect(pts[0]).toEqual([4, 96]);
    expect(pts[1]).toEqual([96, 4]);
  });

  it("clamps out-of-range values and handles a single point", () => {
    expect(plotPoints([10], { width: 100, height: 100, yMax: 2 })).toEqual([[50, 4]]);
  });

  it("renders the reference line alone when empty, and a curve otherwise", () => {
    expect(surpriseSvg([], 4)).not.toContain("polyline");
    expect(surpriseSvg([1, 0.5], 4)).toContain("polyline");
  });

  it("describes state for assistive tech", () => {
    expect(describeSurprise([], 6)).toMatch(/No surprise/);
    expect(describeSurprise([1.234], 6)).toMatch(/1 notes? so far.*1\.23.*1\.79/);
  });
});
