# Work log

Newest entries at the bottom. Each entry records what actually changed, what was learned, and what comes next.

## 2026-11-16 (Day 1)
- Picked "predictive-coding sequence learner" from the Cognition backlog: Rust, a new domain and language compared with the last two projects (Go storage, TypeScript notes).
- Built the core: a predictive-coding network (state prior, free-energy inference by gradient relaxation, local error-driven updates, no BPTT), an order-k n-gram baseline, an alphabet helper, and a deterministic SplitMix64 PRNG.
- Tests: learns a cycle, beats an order-1 n-gram on a sequence needing memory (XABYAC), deterministic, valid distributions, context reset.
- Result worth being honest about: on a plain repeated melody the order-2 n-gram baseline (0.24 nats) still beats the network (0.28). The network's value should show on memory-dependent and hierarchical data, which is what Day 5 targets.
- Added CI (fmt, clippy, tests), a placeholder landing page and the Pages workflow.
- Next: WASM bindings and the Vite + TypeScript scaffold (Day 2).
