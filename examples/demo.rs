//! Terminal demo: watch surprise collapse as the network learns a melody online.
//! Run: cargo run --release --example demo

use hunchnet::sequence::{window_mean, Alphabet};
use hunchnet::{Config, Model, NGram};

fn main() {
    // Twinkle-twinkle-ish melody in solfege letters, repeated.
    let phrase = "CCGGAAGFFEEDDCGGFFEEDGGFFEED";
    let text = phrase.repeat(40);
    let alpha = Alphabet::from_text(&text);
    let seq = alpha.encode(&text).unwrap();

    let mut model = Model::new(Config::new(alpha.len()));
    let mut ngram = NGram::new(alpha.len(), 2, 0.1);
    let (mut pc, mut ng) = (Vec::new(), Vec::new());
    for &s in &seq {
        pc.push(model.observe(s));
        ng.push(ngram.observe(s));
    }
    let w = phrase.len();
    println!(
        "mean surprise per pass of the melody (nats; uniform guess = {:.2})",
        (alpha.len() as f32).ln()
    );
    println!("pass  predictive-coding  order-2 n-gram");
    for (i, (a, b)) in window_mean(&pc, w)
        .iter()
        .zip(window_mean(&ng, w))
        .enumerate()
    {
        if i < 6 || i % 8 == 0 || i == 39 {
            println!(
                "{:>4}  {:>17.3}  {:>14.3}  {}",
                i + 1,
                a,
                b,
                "#".repeat((a * 12.0) as usize)
            );
        }
    }
}
