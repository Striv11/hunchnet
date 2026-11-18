/** Session state for the live view: the symbol stream and surprise history. */

/** The slice of `Model` the session needs (lets tests use a fake). */
export interface Learner {
  readonly vocab: number;
  observe(sym: number): number;
  probs(): Float32Array;
  resetContext(): void;
}

export interface Step {
  sym: number;
  surprise: number;
}

export class Session {
  private steps: Step[] = [];
  private model: Learner;

  /** `fresh` builds a new untrained model; used by `newSequence`. */
  constructor(
    private readonly fresh: () => Learner,
    /** Max steps kept for plotting (older ones are dropped). */
    private readonly maxSteps = 500,
  ) {
    this.model = fresh();
  }

  get vocab(): number {
    return this.model.vocab;
  }

  get history(): readonly Step[] {
    return this.steps;
  }

  get isEmpty(): boolean {
    return this.steps.length === 0;
  }

  /** Feed one symbol; returns its surprise in nats. */
  push(sym: number): number {
    const surprise = this.model.observe(sym);
    this.steps.push({ sym, surprise });
    if (this.steps.length > this.maxSteps) this.steps.shift();
    return surprise;
  }

  /** Distribution over the next symbol. */
  probs(): Float32Array {
    return this.model.probs();
  }

  /** Mean surprise of the last `n` steps (NaN when empty). */
  recentMean(n: number): number {
    const tail = this.steps.slice(-n);
    return tail.reduce((s, x) => s + x.surprise, 0) / tail.length;
  }

  /** Throw away the learned weights and the plot: a brand-new learner. */
  newSequence(): void {
    this.model = this.fresh();
    this.steps = [];
  }
}
