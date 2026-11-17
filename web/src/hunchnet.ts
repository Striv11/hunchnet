/** Typed wrapper around the hunchnet WebAssembly module (C ABI, no glue code). */

interface Exports {
  memory: WebAssembly.Memory;
  hn_new(vocab: number, hidden: number, seed: number): number;
  hn_free(handle: number): void;
  hn_observe(handle: number, sym: number): number;
  hn_reset_context(handle: number): void;
  hn_vocab(handle: number): number;
  hn_probs_ptr(handle: number): number;
}

export interface ModelOptions {
  /** Number of distinct symbols. */
  vocab: number;
  /** Hidden units (default 32). */
  hidden?: number;
  seed?: number;
}

export class Hunchnet {
  private constructor(private readonly wasm: Exports) {}

  /** Instantiate from wasm bytes, or a (promise of a) fetch Response. */
  static async load(
    source: BufferSource | Response | Promise<Response>,
  ): Promise<Hunchnet> {
    let instance: WebAssembly.Instance;
    if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
      ({ instance } = await WebAssembly.instantiate(source, {}));
    } else {
      const res = await source;
      if (!res.ok) throw new Error(`failed to fetch wasm: HTTP ${res.status}`);
      ({ instance } = await WebAssembly.instantiateStreaming(res, {}));
    }
    return new Hunchnet(instance.exports as unknown as Exports);
  }

  create(opts: ModelOptions): Model {
    const hidden = opts.hidden ?? 32;
    const handle = this.wasm.hn_new(opts.vocab, hidden, (opts.seed ?? 1) >>> 0);
    if (handle === 0) throw new RangeError("vocab and hidden must be in 1..=4096");
    return new Model(this.wasm, handle);
  }
}

export class Model {
  readonly vocab: number;
  private handle: number;

  /** @internal use `Hunchnet.create`. */
  constructor(private readonly wasm: Exports, handle: number) {
    this.handle = handle;
    this.vocab = wasm.hn_vocab(handle);
  }

  private live(): number {
    if (this.handle === 0) throw new Error("model has been disposed");
    return this.handle;
  }

  /** Learn from the next symbol; returns its surprise in nats (before learning). */
  observe(sym: number): number {
    const h = this.live();
    if (!Number.isInteger(sym) || sym < 0 || sym >= this.vocab) {
      throw new RangeError(`symbol ${sym} out of range 0..${this.vocab - 1}`);
    }
    return this.wasm.hn_observe(h, sym);
  }

  /** A copy of the current next-symbol distribution (sums to 1). */
  probs(): Float32Array {
    const ptr = this.wasm.hn_probs_ptr(this.live());
    // Read memory.buffer fresh: it is replaced if wasm memory grows.
    return new Float32Array(this.wasm.memory.buffer, ptr, this.vocab).slice();
  }

  /** Forget the running context, keep the learned weights. */
  resetContext(): void {
    this.wasm.hn_reset_context(this.live());
  }

  /** Free the model. Further use throws. */
  dispose(): void {
    if (this.handle !== 0) this.wasm.hn_free(this.handle);
    this.handle = 0;
  }
}
