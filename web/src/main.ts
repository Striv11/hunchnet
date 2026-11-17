import { Hunchnet, Model } from "./hunchnet";

const NOTES = ["C", "D", "E", "F", "G", "A"];
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function render(model: Model, surprise?: number) {
  if (surprise !== undefined) $("surprise").textContent = surprise.toFixed(2);
  const p = model.probs();
  $("probs").textContent = NOTES.map(
    (n, i) => `${n} ${"█".repeat(Math.round(p[i] * 30)).padEnd(30)} ${(p[i] * 100).toFixed(0)}%`,
  ).join("\n");
}

async function main() {
  const hn = await Hunchnet.load(fetch(`${import.meta.env.BASE_URL}hunchnet.wasm`));
  const model = hn.create({ vocab: NOTES.length });
  NOTES.forEach((n, i) => {
    const b = document.createElement("button");
    b.textContent = n;
    b.addEventListener("click", () => render(model, model.observe(i)));
    $("notes").append(b);
  });
  $("status").textContent = "Ready. Play a repeating pattern and watch surprise fall.";
  render(model);
}

main().catch((e) => {
  $("status").textContent = `Could not load the model: ${e instanceof Error ? e.message : e}`;
});
