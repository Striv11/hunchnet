//! Alphabets and sequence helpers.

use std::collections::BTreeMap;

/// Maps characters to dense symbol ids and back.
#[derive(Clone, Debug, Default)]
pub struct Alphabet {
    chars: Vec<char>,
}

impl Alphabet {
    /// Build from the distinct characters of `text`, sorted for determinism.
    pub fn from_text(text: &str) -> Self {
        let mut seen: BTreeMap<char, ()> = BTreeMap::new();
        text.chars().for_each(|c| {
            seen.insert(c, ());
        });
        Alphabet {
            chars: seen.into_keys().collect(),
        }
    }

    pub fn len(&self) -> usize {
        self.chars.len()
    }

    pub fn is_empty(&self) -> bool {
        self.chars.is_empty()
    }

    pub fn encode(&self, text: &str) -> Option<Vec<usize>> {
        text.chars()
            .map(|c| self.chars.binary_search(&c).ok())
            .collect()
    }

    pub fn decode(&self, ids: &[usize]) -> String {
        ids.iter().filter_map(|&i| self.chars.get(i)).collect()
    }
}

/// Mean of `xs` over consecutive windows of `w` (last window may be shorter).
pub fn window_mean(xs: &[f32], w: usize) -> Vec<f32> {
    assert!(w > 0);
    xs.chunks(w)
        .map(|c| c.iter().sum::<f32>() / c.len() as f32)
        .collect()
}
