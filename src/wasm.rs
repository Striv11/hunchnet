//! Dependency-free C ABI for the model, used from JavaScript via WebAssembly.
//!
//! Models live in a handle table so every export is a safe function: JS holds
//! a `u32` handle, never a raw pointer to a `Model`. Invalid handles and
//! symbols are reported with sentinel values instead of panicking (a panic in
//! wasm aborts the whole instance).
//!
//! The table is `thread_local`: wasm32 is single-threaded, and native tests
//! each get their own table.

use crate::model::{Config, Model};
use std::cell::RefCell;

thread_local! {
    static MODELS: RefCell<Vec<Option<Model>>> = const { RefCell::new(Vec::new()) };
}

fn with_model<T>(handle: u32, f: impl FnOnce(&mut Model) -> T) -> Option<T> {
    MODELS.with(|m| {
        let mut m = m.borrow_mut();
        let slot = m.get_mut(handle.checked_sub(1)? as usize)?;
        slot.as_mut().map(f)
    })
}

/// Create a model. Returns a handle (>= 1), or 0 if `vocab` or `hidden` is 0
/// or unreasonably large.
#[no_mangle]
pub extern "C" fn hn_new(vocab: u32, hidden: u32, seed: u32) -> u32 {
    if vocab == 0 || hidden == 0 || vocab > 4096 || hidden > 4096 {
        return 0;
    }
    let mut cfg = Config::new(vocab as usize);
    cfg.hidden = hidden as usize;
    cfg.seed = seed as u64;
    let model = Model::new(cfg);
    MODELS.with(|m| {
        let mut m = m.borrow_mut();
        if let Some(i) = m.iter().position(Option::is_none) {
            m[i] = Some(model);
            i as u32 + 1
        } else {
            m.push(Some(model));
            m.len() as u32
        }
    })
}

/// Release a model. Unknown handles are ignored.
#[no_mangle]
pub extern "C" fn hn_free(handle: u32) {
    MODELS.with(|m| {
        if let Some(slot) = handle
            .checked_sub(1)
            .and_then(|i| m.borrow_mut().get_mut(i as usize).map(|s| s.take()))
        {
            drop(slot);
        }
    });
}

/// Present a symbol; returns its surprise in nats, or -1.0 for a bad handle
/// or an out-of-range symbol.
#[no_mangle]
pub extern "C" fn hn_observe(handle: u32, sym: u32) -> f32 {
    with_model(handle, |m| {
        if (sym as usize) < m.config().vocab {
            m.observe(sym as usize)
        } else {
            -1.0
        }
    })
    .unwrap_or(-1.0)
}

/// Forget the running context but keep the weights.
#[no_mangle]
pub extern "C" fn hn_reset_context(handle: u32) {
    with_model(handle, |m| m.reset_context());
}

/// Number of symbols the model predicts over (0 for a bad handle).
#[no_mangle]
pub extern "C" fn hn_vocab(handle: u32) -> u32 {
    with_model(handle, |m| m.config().vocab as u32).unwrap_or(0)
}

/// Address of the current prediction (`hn_vocab` f32 values) in linear memory,
/// or 0 for a bad handle. Valid until the next call that changes the model;
/// copy it out immediately.
#[no_mangle]
pub extern "C" fn hn_probs_ptr(handle: u32) -> usize {
    with_model(handle, |m| m.probs().as_ptr() as usize).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handles_are_recycled_and_invalid_ones_are_safe() {
        assert_eq!(hn_new(0, 8, 1), 0);
        let a = hn_new(4, 8, 1);
        let b = hn_new(4, 8, 2);
        assert!(a >= 1 && b > a);
        hn_free(a);
        assert_eq!(hn_observe(a, 0), -1.0);
        assert_eq!(hn_new(4, 8, 3), a);
        hn_free(999);
        hn_free(0);
        assert_eq!(hn_vocab(0), 0);
        assert_eq!(hn_probs_ptr(0), 0);
    }

    #[test]
    fn observe_matches_the_rust_api() {
        let h = hn_new(3, 8, 7);
        let mut cfg = Config::new(3);
        cfg.hidden = 8;
        cfg.seed = 7;
        let mut m = Model::new(cfg);
        for s in [0u32, 1, 2, 0, 1, 2] {
            assert_eq!(hn_observe(h, s), m.observe(s as usize));
        }
        assert_eq!(hn_observe(h, 3), -1.0);
        let p = hn_probs_ptr(h) as *const f32;
        let got: Vec<f32> = (0..3).map(|i| unsafe { *p.add(i) }).collect();
        assert_eq!(got, m.probs());
        hn_reset_context(h);
        hn_free(h);
    }
}
