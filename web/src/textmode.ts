/** Text mode: a fixed 28-symbol alphabet (a-z, space, period) and helpers. */

export const TEXT_ALPHABET = "abcdefghijklmnopqrstuvwxyz .";
export const TEXT_LABELS: readonly string[] = [...TEXT_ALPHABET].map((c) => (c === " " ? "␣" : c));

export const TEXT_PRESETS = [
  { id: "cat", name: "the cat sat (repeating)", text: "the cat sat on the mat. " },
  { id: "abc", name: "abc abd (needs memory)", text: "abc abd " },
  { id: "hello", name: "hello world", text: "hello world. " },
] as const;

/** Symbol id for a character, or -1 when it is outside the alphabet. */
export function charToSym(c: string): number {
  return TEXT_ALPHABET.indexOf(c);
}

/**
 * Normalise free text into symbol ids: lower-case, accents stripped, anything
 * outside the alphabet becomes a space, and runs of spaces collapse to one.
 */
export function encodeText(text: string): number[] {
  const flat = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z.]+/g, " ");
  return [...flat].map(charToSym);
}

export function decodeSyms(syms: readonly number[]): string {
  return syms.map((s) => TEXT_ALPHABET[s] ?? "?").join("");
}

/** Loop through `text` forever: symbol `i` of the repeated, encoded text. */
export function loopText(text: string, i: number): number {
  const syms = encodeText(text);
  return syms.length === 0 ? -1 : syms[i % syms.length];
}
