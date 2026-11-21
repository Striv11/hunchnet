//! Predictive-coding sequence learner.
//!
//! Generative model (all quantities are small dense vectors):
//!
//! ```text
//!   h_prior(t) = tanh(A h(t-1) + B o(t-1))     state predicts itself
//!   p(t)       = softmax(C h(t) + b)           state predicts the next symbol
//! ```
//!
//! At each step the network first *predicts* `o(t)` from `h_prior`. Once the
//! symbol arrives, the hidden state is *inferred* by a few steps of gradient
//! descent on the free energy
//!
//! ```text
//!   F(h) = 0.5 * lambda * |h - h_prior|^2  +  CE(o(t), softmax(C h + b))
//! ```
//!
//! i.e. it moves to explain the observation while staying close to its own
//! prior. Learning is purely local and error-driven (no backprop through
//! time): `C`/`b` follow the sensory prediction error `o - p`, and `A`/`B`
//! follow the state prediction error `h - h_prior`.

use crate::rng::Rng;

#[derive(Clone, Debug)]
pub struct Config {
    pub vocab: usize,
    pub hidden: usize,
    /// Learning rate for all weights.
    pub lr: f32,
    /// Inference steps per observation.
    pub infer_steps: usize,
    /// Inference step size.
    pub infer_rate: f32,
    /// Precision of the state prior (higher = trust the prior more).
    pub lambda: f32,
    pub seed: u64,
}

impl Config {
    pub fn new(vocab: usize) -> Self {
        Config {
            vocab,
            hidden: 32,
            lr: 0.05,
            infer_steps: 8,
            infer_rate: 0.2,
            lambda: 0.5,
            seed: 1,
        }
    }
}

#[derive(Clone)]
pub struct Model {
    cfg: Config,
    a: Vec<f32>, // hidden x hidden
    b: Vec<f32>, // hidden x vocab
    c: Vec<f32>, // vocab x hidden
    bias: Vec<f32>,
    h: Vec<f32>,
    prev_sym: Option<usize>,
    // Cached by `predict` for the pending step.
    h_prior: Vec<f32>,
    probs: Vec<f32>,
    /// Additive top-down drive on the prior's pre-activation (from a higher level).
    topdown: Vec<f32>,
    /// Sum of state prediction errors (pre-activation space) since last taken.
    eps_acc: Vec<f32>,
}

pub fn softmax(z: &[f32]) -> Vec<f32> {
    let m = z.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let mut e: Vec<f32> = z.iter().map(|x| (x - m).exp()).collect();
    let s: f32 = e.iter().sum();
    e.iter_mut().for_each(|x| *x /= s);
    e
}

impl Model {
    pub fn new(cfg: Config) -> Self {
        assert!(cfg.vocab > 0 && cfg.hidden > 0);
        let mut rng = Rng::new(cfg.seed);
        let (h, v) = (cfg.hidden, cfg.vocab);
        let mut fill = |n: usize, s: f32| (0..n).map(|_| rng.symmetric(s)).collect::<Vec<f32>>();
        let a = fill(h * h, 0.5 / (h as f32).sqrt());
        let b = fill(h * v, 0.5);
        let c = fill(v * h, 0.1);
        let mut m = Model {
            a,
            b,
            c,
            bias: vec![0.0; v],
            h: vec![0.0; h],
            prev_sym: None,
            h_prior: vec![0.0; h],
            probs: vec![1.0 / v as f32; v],
            topdown: vec![0.0; h],
            eps_acc: vec![0.0; h],
            cfg,
        };
        m.predict();
        m
    }

    pub fn config(&self) -> &Config {
        &self.cfg
    }

    pub fn state(&self) -> &[f32] {
        &self.h
    }

    /// Forget the running context but keep the learned weights.
    pub fn reset_context(&mut self) {
        self.h.iter_mut().for_each(|x| *x = 0.0);
        self.eps_acc.iter_mut().for_each(|x| *x = 0.0);
        self.prev_sym = None;
        self.predict();
    }

    fn logits(&self, h: &[f32]) -> Vec<f32> {
        let (hd, v) = (self.cfg.hidden, self.cfg.vocab);
        (0..v)
            .map(|i| self.bias[i] + (0..hd).map(|j| self.c[i * hd + j] * h[j]).sum::<f32>())
            .collect()
    }

    /// Compute (and cache) the prior state and the distribution over the next symbol.
    pub fn predict(&mut self) -> &[f32] {
        let (hd, v) = (self.cfg.hidden, self.cfg.vocab);
        for i in 0..hd {
            let mut s: f32 = (0..hd).map(|j| self.a[i * hd + j] * self.h[j]).sum();
            if let Some(p) = self.prev_sym {
                s += self.b[i * v + p];
            }
            self.h_prior[i] = (s + self.topdown[i]).tanh();
        }
        self.probs = softmax(&self.logits(&self.h_prior));
        &self.probs
    }

    /// Set the top-down drive from a higher level and refresh the prediction.
    pub fn set_topdown(&mut self, drive: &[f32]) {
        assert_eq!(drive.len(), self.cfg.hidden);
        self.topdown.copy_from_slice(drive);
        self.predict();
    }

    /// Take (and clear) the state prediction errors accumulated since the
    /// last call; this is the gradient signal a higher level learns from.
    pub fn take_state_error(&mut self) -> Vec<f32> {
        std::mem::replace(&mut self.eps_acc, vec![0.0; self.cfg.hidden])
    }

    /// Current prediction (valid after `new`, `observe` or `reset_context`).
    pub fn probs(&self) -> &[f32] {
        &self.probs
    }

    /// "Dream": sample `n` symbols from the model's own generative loop,
    /// feeding each sampled symbol back in. No inference and no learning
    /// happens, and `self` is left untouched (it runs on a copy), so the
    /// same `seed` always yields the same dream.
    pub fn dream(&self, n: usize, seed: u64) -> Vec<usize> {
        let mut m = self.clone();
        let mut rng = Rng::new(seed);
        let mut out = Vec::with_capacity(n);
        for _ in 0..n {
            let r = rng.next_f32();
            let mut acc = 0.0;
            let mut sym = m.probs.len() - 1;
            for (i, p) in m.probs.iter().enumerate() {
                acc += p;
                if r < acc {
                    sym = i;
                    break;
                }
            }
            out.push(sym);
            // Without a real observation the state follows its own prior.
            m.h.clone_from(&m.h_prior);
            m.prev_sym = Some(sym);
            m.predict();
        }
        out
    }

    /// Present the next symbol: infer the state, learn, and return the
    /// surprise (-ln p of the symbol under the prediction made *before* seeing it).
    pub fn observe(&mut self, sym: usize) -> f32 {
        let (hd, v) = (self.cfg.hidden, self.cfg.vocab);
        assert!(sym < v, "symbol out of range");
        let surprise = -self.probs[sym].max(1e-12).ln();

        // Inference: relax h towards explaining the observation.
        let mut h = self.h_prior.clone();
        for _ in 0..self.cfg.infer_steps {
            let p = softmax(&self.logits(&h));
            for j in 0..hd {
                let mut g = self.cfg.lambda * (h[j] - self.h_prior[j]);
                for i in 0..v {
                    let err = p[i] - if i == sym { 1.0 } else { 0.0 };
                    g += self.c[i * hd + j] * err;
                }
                h[j] -= self.cfg.infer_rate * g;
            }
        }

        // Learning, sensory pathway: delta rule on the settled state.
        let p = softmax(&self.logits(&h));
        let lr = self.cfg.lr;
        for i in 0..v {
            let err = (if i == sym { 1.0 } else { 0.0 }) - p[i];
            self.bias[i] += lr * err;
            for j in 0..hd {
                self.c[i * hd + j] += lr * err * h[j];
            }
        }
        // Also train the prior's own readout so the *prediction* improves.
        let pp = softmax(&self.logits(&self.h_prior));
        for i in 0..v {
            let err = (if i == sym { 1.0 } else { 0.0 }) - pp[i];
            for j in 0..hd {
                self.c[i * hd + j] += lr * err * self.h_prior[j];
            }
        }

        // Learning, dynamics pathway: reduce state prediction error h - h_prior.
        for i in 0..hd {
            let eps = (h[i] - self.h_prior[i]) * (1.0 - self.h_prior[i] * self.h_prior[i]);
            self.eps_acc[i] += eps;
            for j in 0..hd {
                self.a[i * hd + j] += lr * eps * self.h[j];
            }
            if let Some(p) = self.prev_sym {
                self.b[i * v + p] += lr * eps;
            }
        }

        self.h = h;
        self.prev_sym = Some(sym);
        self.predict();
        surprise
    }
}
