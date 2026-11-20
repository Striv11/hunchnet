import { describe, expect, it } from "vitest";
import { decodeSyms, encodeText, loopText, TEXT_ALPHABET, TEXT_LABELS, TEXT_PRESETS } from "./textmode";

describe("textmode", () => {
  it("has 28 symbols with readable labels", () => {
    expect(TEXT_ALPHABET.length).toBe(28);
    expect(TEXT_LABELS[26]).toBe("␣");
  });
  it("round-trips normalised text", () => {
    expect(decodeSyms(encodeText("the cat."))).toBe("the cat.");
  });
  it("lower-cases, strips accents and collapses junk to single spaces", () => {
    expect(decodeSyms(encodeText("Café, 42!  Ünï"))).toBe("cafe uni");
    expect(decodeSyms(encodeText("A\n\tB"))).toBe("a b");
  });
  it("encodes only valid ids", () => {
    for (const p of TEXT_PRESETS) {
      expect(encodeText(p.text).every((s) => s >= 0 && s < 28)).toBe(true);
    }
  });
  it("loops and handles empty input", () => {
    expect(decodeSyms([0, 1, 2].map((i) => loopText("ab", i)))).toBe("aba");
    expect(loopText("123", 0)).toBe(26);
    expect(loopText("", 5)).toBe(-1);
  });
});

describe("text mode with the real wasm model", () => {
  it("learns a repeated sentence and predicts the next letter", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const { Hunchnet } = await import("./hunchnet");
    const hn = await Hunchnet.load(
      readFileSync(resolve(__dirname, "../../target/wasm32-unknown-unknown/release/hunchnet.wasm")),
    );
    const m = hn.create({ vocab: TEXT_ALPHABET.length, hidden: 48, seed: 2 });
    const syms = encodeText("the cat sat on the mat. ");
    let first = 0;
    let last = 0;
    for (let pass = 0; pass < 150; pass++) {
      let sum = 0;
      for (const s of syms) sum += m.observe(s);
      if (pass === 0) first = sum / syms.length;
      last = sum / syms.length;
    }
    expect(first).toBeGreaterThan(2);
    expect(last).toBeLessThan(0.5);
    // After "...the ca" the next letter is "t".
    m.resetContext();
    for (const s of encodeText("the ca")) m.observe(s);
    const p = m.probs();
    expect(p.indexOf(Math.max(...p))).toBe(TEXT_ALPHABET.indexOf("t"));
    m.dispose();
  });
});
