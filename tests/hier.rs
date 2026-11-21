use hunchnet::sequence::Alphabet;
use hunchnet::{Config, HierConfig, HierModel, Model};

/// Blocks of `X`/`Y`, then `n` random `a`/`b` fillers, then `.`, then `P` after
/// X or `Q` after Y. The closing symbol is only predictable from the marker
/// n+2 symbols earlier, across noise that carries no information.
fn text(n: usize, blocks: usize) -> String {
    let mut rng = hunchnet::rng::Rng::new(7);
    let mut out = String::new();
    for i in 0..blocks {
        out.push(if i % 2 == 0 { 'X' } else { 'Y' });
        for _ in 0..n {
            out.push(if rng.next_f32() < 0.5 { 'a' } else { 'b' });
        }
        out.push('.');
        out.push(if i % 2 == 0 { 'P' } else { 'Q' });
    }
    out
}

/// Mean surprise on the closing symbols (P/Q) over the last `last` blocks.
fn closing_surprise(seq: &[usize], alpha: &Alphabet, surprises: &[f32], last: usize) -> f32 {
    let (p, q) = (alpha.encode("P").unwrap()[0], alpha.encode("Q").unwrap()[0]);
    let v: Vec<f32> = seq
        .iter()
        .zip(surprises)
        .filter(|(s, _)| **s == p || **s == q)
        .map(|(_, x)| *x)
        .collect();
    v[v.len() - last..].iter().sum::<f32>() / last as f32
}

fn run_both(seed: u64) -> (f32, f32) {
    let t = text(10, 1500);
    let alpha = Alphabet::from_text(&t);
    let seq = alpha.encode(&t).unwrap();
    let base = Config {
        hidden: 32,
        seed,
        ..Config::new(alpha.len())
    };
    let mut single = Model::new(base.clone());
    let s1: Vec<f32> = seq.iter().map(|&s| single.observe(s)).collect();
    let mut hier = HierModel::new(HierConfig {
        base,
        ..HierConfig::new(alpha.len(), 4)
    });
    let s2: Vec<f32> = seq.iter().map(|&s| hier.observe(s)).collect();
    (
        closing_surprise(&seq, &alpha, &s1, 100),
        closing_surprise(&seq, &alpha, &s2, 100),
    )
}

#[test]
fn hierarchy_beats_single_level_on_long_range_sequence() {
    for seed in [1, 2, 3] {
        let (single, hier) = run_both(seed);
        eprintln!("seed {seed}: single {single:.3} hier {hier:.3}");
        assert!(
            hier < single * 0.7,
            "seed {seed}: hier {hier} vs single {single}"
        );
    }
}

#[test]
fn hierarchy_is_deterministic_and_valid() {
    let run = || {
        let mut m = HierModel::new(HierConfig::new(4, 3));
        let s: Vec<f32> = (0..60).map(|i| m.observe(i % 4)).collect();
        let sum: f32 = m.probs().iter().sum();
        assert!((sum - 1.0).abs() < 1e-4);
        s
    };
    assert_eq!(run(), run());
}
