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
