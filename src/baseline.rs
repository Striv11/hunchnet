//! Order-k context-counting baseline (a Markov / n-gram predictor with
//! add-alpha smoothing). It is the yardstick the predictive-coding network
//! is compared against.

use std::collections::HashMap;

pub struct NGram {
    vocab: usize,
    order: usize,
    alpha: f32,
    counts: HashMap<Vec<usize>, Vec<f32>>,
    history: Vec<usize>,
}

impl NGram {
    pub fn new(vocab: usize, order: usize, alpha: f32) -> Self {
        assert!(vocab > 0 && alpha > 0.0);
        NGram {
            vocab,
            order,
            alpha,
            counts: HashMap::new(),
            history: Vec::new(),
        }
    }

    fn context(&self) -> Vec<usize> {
        let n = self.history.len().min(self.order);
        self.history[self.history.len() - n..].to_vec()
    }

    /// Probability distribution over the next symbol.
    pub fn predict(&self) -> Vec<f32> {
        let ctx = self.context();
        let mut p = vec![self.alpha; self.vocab];
        if let Some(c) = self.counts.get(&ctx) {
            for (pi, ci) in p.iter_mut().zip(c) {
                *pi += ci;
            }
        }
        let s: f32 = p.iter().sum();
        p.iter_mut().for_each(|x| *x /= s);
        p
    }

    /// Observe the next symbol; returns its surprise in nats (before learning).
    pub fn observe(&mut self, sym: usize) -> f32 {
        assert!(sym < self.vocab, "symbol out of range");
        let surprise = -self.predict()[sym].ln();
        let ctx = self.context();
        self.counts
            .entry(ctx)
            .or_insert_with(|| vec![0.0; self.vocab])[sym] += 1.0;
        self.history.push(sym);
        surprise
    }
}
