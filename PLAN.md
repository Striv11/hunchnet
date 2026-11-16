# Plan

Seven-day arc. Every milestone has acceptance criteria that can be checked by a test or a command.

| Day | Milestone | Acceptance criteria | Status |
|-----|-----------|---------------------|--------|
| 1 | Rust core: predictive-coding model, n-gram baseline, terminal demo, CI | `bash check.sh` passes; model learns a cycle (tail surprise < 0.1 nats), beats an order-1 n-gram on a memory-dependent sequence, is deterministic per seed; predictions always sum to 1 | [x] |
| 2 | WASM bindings and web scaffold | `wasm32` build succeeds in CI; JS can create a model, call `observe` and read `probs`; Vite + TS app builds; Pages workflow deploys `web/dist`; unit test for the TS wrapper | [ ] |
| 3 | Live visualisation | Predicted-probability bars and a surprise-over-time plot update as symbols stream in; user can type/play symbols; empty state explains what to do; plot resets on "new sequence" | [ ] |
| 4 | Melodies, audio and text mode | Preset melodies and free text; Web Audio plays notes; speed control; model "dreams" (samples its own continuation) and plays it; keyboard shortcuts documented in-app | [ ] |
| 5 | Hierarchy and baseline comparison | Second level predicts slower context for level one; Rust test shows it beats single level on a long-range sequence; UI chart overlays n-gram baseline surprise; save/load weights as a file | [ ] |
| 6 | Quality: e2e, performance, accessibility | Playwright e2e covers load, stream, reset, dream; benchmark shows >= 20k observe/s at hidden=32 in WASM (budget enforced in CI); Lighthouse-style checks: keyboard-only use, aria labels, contrast in light and dark | [ ] |
| 7 | Polish and release | Responsive on a 375px viewport; light/dark theme; loading and error states; landing section; README screenshots; WORKLOG retrospective; live Pages link verified | [ ] |

## Stretch
- Surprise-driven "attention": highlight the notes the model found most surprising.
- Compare hidden sizes interactively.
- Import a MIDI file as the sequence.
