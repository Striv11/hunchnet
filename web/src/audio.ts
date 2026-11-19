import { FREQS } from "./melodies";

/** Tiny Web Audio player: one short sine blip per note. Created lazily on a user gesture. */
export class NotePlayer {
  private ctx: AudioContext | null = null;
  muted = false;

  play(note: number, durationMs = 300): void {
    if (this.muted || !(note in FREQS)) return;
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    this.ctx ??= new Ctor();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const t = this.ctx.currentTime;
    const dur = Math.min(durationMs / 1000, 0.6);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = FREQS[note];
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}
