use hunchnet::sequence::{window_mean, Alphabet};
use hunchnet::{Config, Model, NGram};

fn run(text: &str, cfg_fn: impl Fn(usize) -> Config) -> (Vec<f32>, usize) {
    let alpha = Alphabet::from_text(text);
    let seq = alpha.encode(text).unwrap();
    let mut m = Model::new(cfg_fn(alpha.len()));
    (seq.iter().map(|&s| m.observe(s)).collect(), alpha.len())
}

#[test]
fn starts_near_uniform_surprise() {
    let (s, v) = run(&"ABCD".repeat(50), Config::new);
    let uniform = (v as f32).ln();
    assert!(
        (s[0] - uniform).abs() < 0.3,
        "first surprise {} vs {}",
        s[0],
        uniform
    );
}

#[test]
fn learns_a_cycle() {
    let (s, _) = run(&"ABCD".repeat(150), Config::new);
    let tail = window_mean(&s[s.len() - 80..], 80)[0];
    assert!(tail < 0.1, "tail surprise {tail}");
}

#[test]
fn learns_context_that_needs_memory() {
    // After A comes B or C depending on what preceded A: "XAB" / "YAC" alternate.
    // An order-1 predictor cannot do better than ln 2 on the symbol after A.
    let text = "XABYAC".repeat(300);
    let (s, _) = run(&text, |v| Config {
        hidden: 48,
        ..Config::new(v)
    });
    let tail = window_mean(&s[s.len() - 600..], 600)[0];
    let alpha = Alphabet::from_text(&text);
    let seq = alpha.encode(&text).unwrap();
    let mut o1 = NGram::new(alpha.len(), 1, 0.1);
    let o1s: Vec<f32> = seq.iter().map(|&x| o1.observe(x)).collect();
    let o1_tail = window_mean(&o1s[o1s.len() - 600..], 600)[0];
    assert!(
        tail < o1_tail * 0.6,
        "pc {tail} should beat order-1 {o1_tail}"
    );
}

#[test]
fn is_deterministic_given_seed() {
    let t = "ABACABAD".repeat(20);
    assert_eq!(run(&t, Config::new).0, run(&t, Config::new).0);
}

#[test]
fn predictions_are_distributions() {
    let mut m = Model::new(Config::new(5));
    for s in [0, 1, 2, 3, 4, 0, 1] {
        m.observe(s);
        let p = m.probs();
        assert!((p.iter().sum::<f32>() - 1.0).abs() < 1e-4);
        assert!(p.iter().all(|x| x.is_finite() && *x >= 0.0));
    }
}

#[test]
fn reset_context_keeps_weights() {
    let text = "ABCD".repeat(100);
    let alpha = Alphabet::from_text(&text);
    let seq = alpha.encode(&text).unwrap();
    let mut m = Model::new(Config::new(4));
    seq.iter().for_each(|&s| {
        m.observe(s);
    });
    m.reset_context();
    assert!(m.state().iter().all(|x| *x == 0.0));
    // Feeding the start of the cycle again should be quickly predicted.
    m.observe(0);
    assert_eq!(
        m.probs()
            .iter()
            .cloned()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(&b.1))
            .unwrap()
            .0,
        1
    );
}

#[test]
fn alphabet_roundtrip() {
    let a = Alphabet::from_text("hello");
    assert_eq!(a.decode(&a.encode("hello").unwrap()), "hello");
    assert!(a.encode("z").is_none());
}

#[test]
fn ngram_learns_cycle() {
    let mut n = NGram::new(4, 1, 0.1);
    let s: Vec<f32> = (0..200).map(|i| n.observe(i % 4)).collect();
    assert!(s[199] < 0.1);
}

#[test]
fn dream_replays_a_learned_cycle_without_learning() {
    let mut m = Model::new(Config::new(4));
    for i in 0..4000 {
        m.observe(i % 4);
    }
    // Context is "just saw 3" (4000 % 4 == 0 -> last symbol was 3).
    let before = m.probs().to_vec();
    let d = m.dream(40, 9);
    assert_eq!(m.probs(), &before[..], "dreaming must not change the model");
    assert_eq!(d, m.dream(40, 9), "same seed, same dream");
    let follows = d.windows(2).filter(|w| w[1] == (w[0] + 1) % 4).count();
    assert!(
        follows >= 30,
        "dream should follow the cycle, got {follows}/39: {d:?}"
    );
}

#[test]
fn dream_seed_matters_for_an_untrained_model() {
    let m = Model::new(Config::new(6));
    assert_ne!(m.dream(30, 1), m.dream(30, 2));
}
