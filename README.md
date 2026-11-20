# hunchnet

> A brain-inspired sequence learner, written from scratch in Rust and compiled to WebAssembly, that learns melodies and text online while you watch its predictions and its surprise.

**Live demo:** https://striv11.github.io/hunchnet/ (a minimal in-browser demo; richer visualisation is on the roadmap)

![CI](https://github.com/Striv11/hunchnet/actions/workflows/ci.yml/badge.svg)

## Problem
Most sequence models are trained offline with backpropagation through time, and the training process is a black box. It is hard to *see* what a model expects next, when it is surprised, and how that surprise fades as it learns. People who want an intuition for prediction-driven learning have nowhere to play with it.

## Motivation
Predictive coding is a theory in which the brain keeps a generative model and learns by minimising prediction error, using only local updates. hunchnet implements a small version from scratch (no ML libraries, no backprop through time) to explore:
- online learning: one symbol at a time, no epochs, no dataset;
- inference by relaxation: hidden state settles by gradient descent on a free energy before weights change;
- honest comparison against a classic order-k n-gram baseline, so claims are measurable;
- Rust to WASM, so the same deterministic core runs natively, in tests and in the browser with no server and no data leaving the device.

## Architecture
```
 symbol o(t-1) ─┐                       ┌──────────── prediction p(t) = softmax(C·h_prior + b)
                ├─► h_prior = tanh(A·h(t-1) + B·o(t-1)) ─┤
 state h(t-1) ──┘                       └─ compare with the symbol that actually arrives, o(t)
                                                │
              surprise = -ln p(o(t))            ▼
                          infer h(t): descend F(h) = ½λ|h-h_prior|² + CE(o(t), softmax(C·h+b))
                                                │
                          local updates:  C,b ← sensory error (o - p)·h
                                          A,B ← state error (h - h_prior)
```
Modules (`src/`): `model.rs` (the network), `baseline.rs` (order-k n-gram), `sequence.rs` (alphabet and helpers), `rng.rs` (SplitMix64, deterministic across platforms). `wasm.rs` is a dependency-free C ABI (handle table, no panics across the boundary) that `web/src/hunchnet.ts` wraps; `web/` is a Vite + TypeScript app (`session.ts` holds stream state, `plot.ts` builds the SVG; both are DOM-free and unit-tested).

Invariants: predictions are always valid probability distributions; runs are deterministic for a given seed; surprise is measured *before* learning from the symbol.

## Setup
Prerequisites: Rust stable (1.80+). The web build later also needs Node 20+ and the `wasm32-unknown-unknown` target.
```bash
git clone https://github.com/Striv11/hunchnet && cd hunchnet
bash check.sh                      # fmt + clippy + tests
cargo run --release --example demo # terminal demo
# browser demo (needs Node 20+ and `rustup target add wasm32-unknown-unknown`)
cd web && npm ci && npm test && npm run dev
```

## Demo
Terminal demo (works today). Output from `cargo run --release --example demo`: surprise per pass of a 28-note melody, repeated 40 times, falls from 1.69 nats (about a uniform guess, ln 6 = 1.79) to 0.28 as the network learns online. The order-2 n-gram baseline reaches 0.24, so on this simple melody the baseline wins; the interesting comparisons are on contexts that need memory (see `tests/learning.rs`).

Browser demo: the Rust core compiled to WebAssembly; press notes (buttons, or keys `1`-`6` / `C D E F G A`) and watch predicted-probability bars and a surprise-over-time plot update live; "New sequence" starts over with an untrained model. Pick a preset melody and press Play (or Space) to stream it into the model with Web Audio sound and a speed control; press **Dream** and the model samples 16 notes from its own predictions and plays them, without learning from them (`Model::dream`, `hn_dream`). Switch **Mode** to *Text* to feed free text (a–z, space, period; other characters become spaces), loop a preset sentence, and dream text; the bars then show next-character probabilities. The dashed line on the plot is the surprise of a uniform guess.

## Design decisions & trade-offs
- **No BPTT.** Updates are local to each step; this is the point of the exercise, at the cost of weaker long-range credit assignment than an LSTM.
- **One-hot discrete symbols.** Keeps surprise interpretable in nats and fits notes and characters.
- **Hand-rolled dense math on `Vec<f32>`.** Hidden sizes are small (tens of units), so clarity beats BLAS.
- **Plain C ABI instead of wasm-bindgen.** The surface is seven functions, so a hand-written typed wrapper avoids a toolchain dependency and keeps the wasm at ~38 KB.
- **Deterministic PRNG** instead of `rand`, so tests and WASM match exactly.

## Roadmap
See [PLAN.md](PLAN.md) for the seven-day arc.
- [x] Core predictive-coding model, n-gram baseline, tests, terminal demo
- [x] WASM bindings and web scaffold
- [x] Prediction and surprise visualisation
- [x] Melody playback, speed control and dreaming
- [x] Text mode
- [ ] Two-level hierarchy and baseline comparison charts
- [ ] End-to-end tests, performance budget, accessibility
- [ ] Polish, screenshots, docs

## License
MIT. See [LICENSE](LICENSE).
