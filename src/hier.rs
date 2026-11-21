//! Two-level predictive-coding hierarchy.
//!
//! Level 1 is the ordinary [`Model`]. Level 2 holds a slow state `g` that
//! only changes every `stride` symbols. It sends a top-down drive `D g` into
//! level 1's state prior, so level 1 can use context far older than its own
//! fast dynamics retain.
//!
//! At each chunk boundary level 2 does what level 1 does per symbol: it
//! *infers* `g` by moving it along the accumulated state prediction error of
//! level 1 (the gradient of level 1's free energy w.r.t. `g`), learns `D`
//! locally (error x `g`), then predicts its next state from the inferred
//! state and the mean level-1 state of the chunk. All updates are local.

use crate::model::{Config, Model};
use crate::rng::Rng;

#[derive(Clone, Debug)]
pub struct HierConfig {
    pub base: Config,
    pub hidden2: usize,
    /// Symbols per level-2 step.
    pub stride: usize,
    pub lr2: f32,
    /// Inference step size for the slow state.
    pub infer_rate2: f32,
}

impl HierConfig {
    pub fn new(vocab: usize, stride: usize) -> Self {
        HierConfig {
            base: Config::new(vocab),
            hidden2: 16,
            stride,
            lr2: 0.05,
            infer_rate2: 1.0,
        }
    }
}

#[derive(Clone)]
pub struct HierModel {
    cfg: HierConfig,
    l1: Model,
    d: Vec<f32>,  // hidden1 x hidden2 (top-down)
    a2: Vec<f32>, // hidden2 x hidden2
    b2: Vec<f32>, // hidden2 x hidden1
    g: Vec<f32>,  // slow state in use during the current chunk
    g_inf_prev: Vec<f32>,
    mean_prev: Vec<f32>,
    pooled: Vec<f32>,
    count: usize,
}

impl HierModel {
    pub fn new(cfg: HierConfig) -> Self {
        assert!(cfg.stride > 0 && cfg.hidden2 > 0);
        let (h1, h2) = (cfg.base.hidden, cfg.hidden2);
        let mut rng = Rng::new(cfg.base.seed ^ 0x9e37_79b9);
        let mut fill = |n: usize, s: f32| (0..n).map(|_| rng.symmetric(s)).collect::<Vec<f32>>();
        let d = fill(h1 * h2, 0.3);
        let a2 = fill(h2 * h2, 0.5 / (h2 as f32).sqrt());
        let b2 = fill(h2 * h1, 0.3);
        let l1 = Model::new(cfg.base.clone());
        let mut m = HierModel {
            l1,
            d,
            a2,
            b2,
            g: vec![0.0; h2],
            g_inf_prev: vec![0.0; h2],
            mean_prev: vec![0.0; h1],
            pooled: vec![0.0; h1],
            count: 0,
            cfg,
        };
        m.push_topdown();
        m
    }

    pub fn config(&self) -> &HierConfig {
        &self.cfg
    }

    pub fn probs(&self) -> &[f32] {
        self.l1.probs()
    }

    /// The slow state, for inspection.
    pub fn slow_state(&self) -> &[f32] {
        &self.g
    }

    fn push_topdown(&mut self) {
        let (h1, h2) = (self.cfg.base.hidden, self.cfg.hidden2);
        let drive: Vec<f32> = (0..h1)
            .map(|i| (0..h2).map(|j| self.d[i * h2 + j] * self.g[j]).sum())
            .collect();
        self.l1.set_topdown(&drive);
    }

    pub fn reset_context(&mut self) {
        self.l1.reset_context();
        for v in [
            &mut self.g,
            &mut self.g_inf_prev,
            &mut self.mean_prev,
            &mut self.pooled,
        ] {
            v.iter_mut().for_each(|x| *x = 0.0);
        }
        self.count = 0;
        self.push_topdown();
    }

    /// Present the next symbol; returns the surprise under the prior prediction.
    pub fn observe(&mut self, sym: usize) -> f32 {
        let surprise = self.l1.observe(sym);
        for (p, x) in self.pooled.iter_mut().zip(self.l1.state()) {
            *p += x;
        }
        self.count += 1;
        if self.count == self.cfg.stride {
            self.boundary();
        }
        surprise
    }

    fn boundary(&mut self) {
        let (h1, h2) = (self.cfg.base.hidden, self.cfg.hidden2);
        let k = self.cfg.stride as f32;
        let eps: Vec<f32> = self.l1.take_state_error().iter().map(|e| e / k).collect();
        let mean: Vec<f32> = self.pooled.iter().map(|p| p / k).collect();
        let lr2 = self.cfg.lr2;

        // Infer g: move along the gradient of level 1's free energy.
        let g_used = self.g.clone();
        let mut g_inf = g_used.clone();
        for j in 0..h2 {
            let grad: f32 = (0..h1).map(|i| self.d[i * h2 + j] * eps[i]).sum();
            g_inf[j] = (g_inf[j] + self.cfg.infer_rate2 * grad).clamp(-1.0, 1.0);
        }
        // Learn D (local: error x presynaptic slow state).
        for i in 0..h1 {
            for j in 0..h2 {
                self.d[i * h2 + j] += lr2 * eps[i] * g_used[j];
            }
        }
        // Learn level-2 dynamics: last boundary's prediction was `g_used`.
        for i in 0..h2 {
            let e = (g_inf[i] - g_used[i]) * (1.0 - g_used[i] * g_used[i]);
            for j in 0..h2 {
                self.a2[i * h2 + j] += lr2 * e * self.g_inf_prev[j];
            }
            for j in 0..h1 {
                self.b2[i * h1 + j] += lr2 * e * self.mean_prev[j];
            }
        }
        // Predict the next slow state.
        for i in 0..h2 {
            let s: f32 = (0..h2).map(|j| self.a2[i * h2 + j] * g_inf[j]).sum::<f32>()
                + (0..h1).map(|j| self.b2[i * h1 + j] * mean[j]).sum::<f32>();
            self.g[i] = s.tanh();
        }
        self.g_inf_prev = g_inf;
        self.mean_prev = mean;
        self.pooled.iter_mut().for_each(|x| *x = 0.0);
        self.count = 0;
        self.push_topdown();
    }
}
