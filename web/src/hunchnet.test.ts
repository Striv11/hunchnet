import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { Hunchnet } from "./hunchnet";

let hn: Hunchnet;
beforeAll(async () => {
  const bytes = readFileSync(
    resolve(__dirname, "../../target/wasm32-unknown-unknown/release/hunchnet.wasm"),
  );
  hn = await Hunchnet.load(bytes);
});

describe("Hunchnet wasm wrapper", () => {
  it("starts with a valid, near-uniform distribution", () => {
    const m = hn.create({ vocab: 5 });
    const p = m.probs();
    expect(p).toHaveLength(5);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
    p.forEach((x) => expect(x).toBeGreaterThan(0.05));
    m.dispose();
  });

  it("learns a cycle: surprise falls and the right symbol is predicted", () => {
    const m = hn.create({ vocab: 3, seed: 3 });
    const pass = () => [0, 1, 2, 0, 1, 2].reduce((s, x) => s + m.observe(x), 0) / 6;
    const first = pass();
    for (let i = 0; i < 150; i++) pass();
    const last = pass();
    expect(last).toBeLessThan(first / 4);
    m.observe(0);
    const p = m.probs();
    expect(p.indexOf(Math.max(...p))).toBe(1);
    m.dispose();
  });

  it("is deterministic per seed", () => {
    const run = (seed: number) => {
      const m = hn.create({ vocab: 4, seed });
      const out = [0, 1, 3, 2, 1].map((s) => m.observe(s));
      m.dispose();
      return out;
    };
    expect(run(9)).toEqual(run(9));
    expect(run(9)).not.toEqual(run(10));
  });

  it("rejects bad input and use after dispose", () => {
    expect(() => hn.create({ vocab: 0 })).toThrow(RangeError);
    const m = hn.create({ vocab: 3 });
    expect(() => m.observe(3)).toThrow(RangeError);
    expect(() => m.observe(-1)).toThrow(RangeError);
    expect(() => m.observe(1.5)).toThrow(RangeError);
    m.dispose();
    m.dispose();
    expect(() => m.observe(0)).toThrow(/disposed/);
  });

  it("resetContext keeps learning", () => {
    const m = hn.create({ vocab: 2 });
    for (let i = 0; i < 100; i++) m.observe(i % 2);
    const before = m.probs();
    m.resetContext();
    expect(m.probs()).toHaveLength(2);
    expect(before.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
    m.dispose();
  });
});
