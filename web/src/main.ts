import { Hunchnet } from "./hunchnet";
import { describeSurprise, surpriseSvg } from "./plot";
import { NotePlayer } from "./audio";
import { clampInterval, loopNote, NOTES, PRESETS, SPEEDS } from "./melodies";
import { Session } from "./session";
import { decodeSyms, encodeText, loopText, TEXT_ALPHABET, TEXT_LABELS, TEXT_PRESETS } from "./textmode";

const NOTES_EMPTY = document.getElementById("empty")?.textContent ?? "";
const TEXT_EMPTY = "Nothing yet. Feed some text or loop a preset; repeated words make the next-letter bars sharpen and the surprise line fall.";
const $ = <T extends Element = HTMLElement>(id: string) => document.getElementById(id) as unknown as T;

function render(s: Session, labels: readonly string[]) {
  const last = s.history[s.history.length - 1];
  $("surprise").textContent = last ? last.surprise.toFixed(2) : "–";
  $("empty").hidden = !s.isEmpty;
  const p = s.probs();
  const rows = labels.map(
    (n, i) =>
      `<span aria-hidden="true">${n}</span><span class="bar" role="listitem" aria-label="${n}: ${(p[i] * 100).toFixed(0)}%"><i style="width:${(p[i] * 100).toFixed(1)}%"></i></span><span>${(p[i] * 100).toFixed(0)}%</span>`,
  );
  $("empty").textContent = labels === NOTES ? NOTES_EMPTY : TEXT_EMPTY;
  $("probs").innerHTML = rows.join("");
  const values = s.history.map((x) => x.surprise);
  $("plot").innerHTML = surpriseSvg(values, s.vocab);
  $("plot").setAttribute("aria-label", describeSurprise(values, s.vocab));
}

async function main() {
  const hn = await Hunchnet.load(fetch(`${import.meta.env.BASE_URL}hunchnet.wasm`));
  let seed = 1;
  const notesSession = new Session(() => hn.create({ vocab: NOTES.length, seed: seed++ }));
  const textSession = new Session(() => hn.create({ vocab: TEXT_ALPHABET.length, seed: seed++, hidden: 48 }));
  let textMode = false;
  let session = notesSession;
  const labels = () => (textMode ? TEXT_LABELS : NOTES);
  const draw = () => {
    render(session, labels());
    $("tseen").textContent = decodeSyms(textSession.history.slice(-60).map((x) => x.sym));
  };
  const player = new NotePlayer();
  const interval = () => clampInterval(Number($<HTMLSelectElement>("speed").value));
  const press = (i: number, quiet = false) => {
    session.push(i);
    if (!quiet) player.play(i, interval());
    draw();
  };

  // One timer at a time: either a preset is being played into the model, or a dream is playing.
  let timer: number | undefined;
  const stop = (msg?: string) => {
    window.clearInterval(timer);
    timer = undefined;
    document.querySelectorAll<HTMLButtonElement>("[data-run]").forEach((b) => {
      b.textContent = b.dataset.label!;
      b.setAttribute("aria-pressed", "false");
    });
    if (msg) $("status").textContent = msg;
  };
  const run = (btn: HTMLButtonElement, tick: (i: number) => boolean | void, msg: string) => {
    if (timer !== undefined) return stop("Stopped.");
    let i = 0;
    btn.textContent = "Stop";
    btn.setAttribute("aria-pressed", "true");
    $("status").textContent = msg;
    timer = window.setInterval(() => {
      if (tick(i++) === false) stop("Done.");
    }, interval());
  };

  PRESETS.forEach((p) => $("preset").append(new Option(p.name, p.id)));
  SPEEDS.forEach((s) => $("speed").append(new Option(s.label, String(s.ms), false, s.ms === 350)));
  const play = $<HTMLButtonElement>("play");
  play.addEventListener("click", () => {
    const preset = PRESETS.find((p) => p.id === $<HTMLSelectElement>("preset").value) ?? PRESETS[0];
    run(play, (i) => press(loopNote(preset.notes, i)), `Playing "${preset.name}" on a loop. Watch surprise fall.`);
  });
  const dream = $<HTMLButtonElement>("dream");
  dream.addEventListener("click", () => {
    const notes = session.dream(16, Date.now());
    run(
      dream,
      (i) => {
        if (i >= notes.length) return false;
        player.play(notes[i], interval());
        $("dreamed").textContent = notes.slice(0, i + 1).map((n) => NOTES[n]).join(" ");
      },
      "Dreaming: the model plays its own continuation. It is not learning from this.",
    );
  });
  // Text mode.
  const feed = (syms: number[]) => {
    syms.filter((s) => s >= 0).forEach((s) => textSession.push(s));
    draw();
  };
  TEXT_PRESETS.forEach((p) => $("tpreset").append(new Option(p.name, p.id)));
  $("feed").addEventListener("click", () => {
    stop();
    feed(encodeText($<HTMLTextAreaElement>("text-input").value));
    $("status").textContent = "Fed the text to the model once.";
  });
  const tplay = $<HTMLButtonElement>("tplay");
  tplay.addEventListener("click", () => {
    const preset = TEXT_PRESETS.find((p) => p.id === $<HTMLSelectElement>("tpreset").value) ?? TEXT_PRESETS[0];
    run(tplay, (i) => feed([loopText(preset.text, i)]), `Looping "${preset.name}". Watch surprise fall.`);
  });
  const tdream = $<HTMLButtonElement>("tdream");
  tdream.addEventListener("click", () => {
    const out = decodeSyms(textSession.dream(40, Date.now()));
    run(
      tdream,
      (i) => {
        if (i >= out.length) return false;
        $("tdreamed").textContent = out.slice(0, i + 1);
      },
      "Dreaming text. The model is not learning from this.",
    );
  });
  $<HTMLSelectElement>("mode").addEventListener("change", (e) => {
    stop();
    textMode = (e.target as HTMLSelectElement).value === "text";
    session = textMode ? textSession : notesSession;
    $("notes-ui").hidden = textMode;
    $("text-ui").hidden = !textMode;
    $("probs").setAttribute("aria-label", `Predicted probability of each next ${textMode ? "character" : "note"}`);
    draw();
    $("status").textContent = textMode ? "Text mode: the model predicts the next character." : "Notes mode.";
  });
  $<HTMLInputElement>("mute").addEventListener("change", (e) => {
    player.muted = (e.target as HTMLInputElement).checked;
  });
  NOTES.forEach((n, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = n;
    b.setAttribute("aria-keyshortcuts", `${i + 1} ${n}`);
    b.addEventListener("click", () => press(i));
    $("notes").append(b);
  });
  $("reset").addEventListener("click", () => {
    stop();
    session.newSequence();
    $("dreamed").textContent = "";
    $("tdreamed").textContent = "";
    draw();
    $("status").textContent = "Started a new sequence with an untrained model.";
  });
  document.addEventListener("keydown", (e) => {
    if (textMode) return;
    if (e.key === " " && (e.target as HTMLElement).tagName !== "BUTTON") {
      e.preventDefault();
      play.click();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
    const i = /^[1-6]$/.test(e.key) ? Number(e.key) - 1 : (NOTES as readonly string[]).indexOf(e.key.toUpperCase());
    if (i >= 0 && e.key.length === 1) press(i);
  });
  $("status").textContent = "Ready. Play a repeating pattern and watch surprise fall.";
  draw();
}

main().catch((e) => {
  $("status").textContent = `Could not load the model: ${e instanceof Error ? e.message : e}`;
});
