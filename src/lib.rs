//! hunchnet: an online predictive-coding sequence learner.

pub mod baseline;
pub mod hier;
pub mod model;
pub mod rng;
pub mod sequence;
pub mod wasm;

pub use baseline::NGram;
pub use hier::{HierConfig, HierModel};
pub use model::{Config, Model};
