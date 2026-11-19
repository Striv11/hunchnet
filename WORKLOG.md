# Work log

Newest entries at the bottom. Each entry records what actually changed, what was learned, and what comes next.

## 2026-11-16 (Day 1)
- Picked "predictive-coding sequence learner" from the Cognition backlog: Rust, a new domain and language compared with the last two projects (Go storage, TypeScript notes).
- Built the core: a predictive-coding network (state prior, free-energy inference by gradient relaxation, local error-driven updates, no BPTT), an order-k n-gram baseline, an alphabet helper, and a deterministic SplitMix64 PRNG.
- Tests: learns a cycle, beats an order-1 n-gram on a sequence needing memory (XABYAC), deterministic, valid distributions, context reset.
- Result worth being honest about: on a plain repeated melody the order-2 n-gram baseline (0.24 nats) still beats the network (0.28). The network's value should show on memory-dependent and hierarchical data, which is what Day 5 targets.
- Added CI (fmt, clippy, tests), a placeholder landing page and the Pages workflow.
- Next: WASM bindings and the Vite + TypeScript scaffold (Day 2).

## 2026-11-17 (Day 2)
- Added `src/wasm.rs`: a dependency-free C ABI over the model using a handle table, so every export is safe Rust and bad handles or symbols return sentinels rather than panicking (a panic would abort the wasm instance). Native unit tests cover handle recycling and parity with the Rust API.
- Added the `web/` Vite + TypeScript app: typed `Hunchnet`/`Model` wrapper (range checks, dispose, copies probs out of wasm memory), vitest tests running against the real wasm build, and a minimal playable page.
- CI now has a `web` job (wasm build, vitest, vite build); the Pages workflow builds and deploys `web/dist`.
- Learned: skipping wasm-bindgen is cheap at this API size; the wasm is ~38 KB. Read `memory.buffer` fresh on each call since it detaches on growth.
- Not verified locally: the Pages deploy itself (needs GitHub). Next: Day 3, live probability bars and surprise-over-time plot.

## 2026-11-18 (Day 3)
- Live visualisation: probability bars (with aria labels) and an SVG surprise-over-time plot with a dashed uniform-guess reference line; empty state explains what to do; "New sequence" builds a fresh untrained model and clears the plot; keyboard input (`1`-`6`, note letters).
- Kept logic out of the DOM: `Session` (history, cap, reset) and `plot.ts` (pure SVG/point builders, screen-reader description) have vitest tests with a fake learner, so they run without a browser.
- Learned: the wasm target had to be installed locally (`rustup target add wasm32-unknown-unknown`) to run the web tests; no Playwright yet, so the DOM wiring in `main.ts` is only verified by typecheck and build. Day 6 e2e should cover it.
- Next: Day 4, preset melodies, Web Audio playback, text mode, dreaming.

## 2026-11-19 (Day 4)
- Added `Model::dream(n, seed)`: samples from the model's own generative loop (state follows its prior, no inference, no learning) on a clone, so the live model is untouched. Exposed as `hn_dream` and `Model.dream` in the wrapper.
- Tests: a trained cycle is dreamed back (>= 30/39 transitions follow it), dreaming leaves `probs` unchanged, same seed gives the same dream. Learned that a well-trained model is so confident that different seeds give the *same* dream, so seed sensitivity is tested on an untrained model.
- Web: preset melodies (including a memory-dependent one), Web Audio note player, speed select, mute, Play/Dream buttons with Stop, Space shortcut, shortcuts documented in-page. Pure data/helpers live in `melodies.ts` with tests; DOM timer wiring is still only typechecked and built (e2e is Day 6).
- Day 4 is marked partial: free-text mode is not done. It needs a variable-size alphabet, which the fixed six-note UI does not support yet.
- Next: text mode (alphabet from input, reuse Session), then Day 5 hierarchy.
