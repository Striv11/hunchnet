import { Hunchnet } from "./hunchnet";
import { describeSurprise, surpriseSvg } from "./plot";
import { Session } from "./session";

const NOTES = ["C", "D", "E", "F", "G", "A"];
const $ = <T extends Element = HTMLElement>(id: string) => document.getElementById(id) as unknown as T;

function render(s: Session) {
  const last = s.history[s.history.length - 1];
  $("surprise").textContent = last ? last.surprise.toFixed(2) : "–";
  $("empty").hidden = !s.isEmpty;
  const p = s.probs();
  const rows = NOTES.map(
    (n, i) =>
      `<span aria-hidden="true">${n}</span><span class="bar" role="listitem" aria-label="${n}: ${(p[i] * 100).toFixed(0)}%"><i style="width:${(p[i] * 100).toFixed(1)}%"></i></span><span>${(p[i] * 100).toFixed(0)}%</span>`,
  );
  $("probs").innerHTML = rows.join("");
  const values = s.history.map((x) => x.surprise);
  $("plot").innerHTML = surpriseSvg(values, s.vocab);
  $("plot").setAttribute("aria-label", describeSurprise(values, s.vocab));
}

async function main() {
  const hn = await Hunchnet.load(fetch(`${import.meta.env.BASE_URL}hunchnet.wasm`));
  let seed = 1;
  const session = new Session(() => hn.create({ vocab: NOTES.length, seed: seed++ }));
  const press = (i: number) => {
    session.push(i);
    render(session);
  };
  NOTES.forEach((n, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = n;
    b.setAttribute("aria-keyshortcuts", `${i + 1} ${n}`);
    b.addEventListener("click", () => press(i));
    $("notes").append(b);
  });
  $("reset").addEventListener("click", () => {
    session.newSequence();
    render(session);
    $("status").textContent = "Started a new sequence with an untrained model.";
  });
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target as HTMLElement;
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
    const i = /^[1-6]$/.test(e.key) ? Number(e.key) - 1 : NOTES.indexOf(e.key.toUpperCase());
    if (i >= 0 && e.key.length === 1) press(i);
  });
  $("status").textContent = "Ready. Play a repeating pattern and watch surprise fall.";
  render(session);
}

main().catch((e) => {
  $("status").textContent = `Could not load the model: ${e instanceof Error ? e.message : e}`;
});
