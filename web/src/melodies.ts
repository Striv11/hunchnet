/** Note names, frequencies and preset melodies (pure data and helpers). */

export const NOTES = ["C", "D", "E", "F", "G", "A"] as const;
/** C major scale from C4, in Hz. */
export const FREQS = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0] as const;

export interface Preset {
  id: string;
  name: string;
  notes: number[];
}

export const PRESETS: readonly Preset[] = [
  { id: "scale", name: "Scale up and down", notes: [0, 1, 2, 3, 4, 5, 4, 3, 2, 1] },
  { id: "twinkle", name: "Twinkle, twinkle", notes: [0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0] },
  { id: "ode", name: "Ode to Joy", notes: [2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1, 1] },
  // Needs memory: the symbol after C depends on what came before it.
  { id: "memory", name: "Memory test (E C D, E C F)", notes: [2, 0, 1, 2, 0, 3] },
];

export const SPEEDS = [
  { label: "Slow", ms: 600 },
  { label: "Medium", ms: 350 },
  { label: "Fast", ms: 150 },
] as const;

/** Clamp a tempo (ms per note) to a sane playable range. */
export function clampInterval(ms: number): number {
  return Number.isFinite(ms) ? Math.min(2000, Math.max(60, Math.round(ms))) : 350;
}

/** Note `i` of an endlessly repeating melody. */
export function loopNote(notes: readonly number[], i: number): number {
  return notes[i % notes.length];
}
