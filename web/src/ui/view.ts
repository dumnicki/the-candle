import arrivalUrl from "../assets/sfx/ghost-arrival.wav";
import lighterUrl from "../assets/lighter.svg";
import { createRoomAmbience } from "../scene/ambience.js";
import { pickGhost, windFromCursor } from "../scene/blow.js";
import { mountCandle, type CandleScene } from "../scene/candle.js";
import { createBlowListener, createBlowTrack, trackBlow } from "../scene/mic.js";
import type { RoomState } from "../session/session.js";
import { captionLetters } from "./caption.js";
import { pickOmen } from "./omen.js";
import { presentRoom, type RoomButton, type RoomPresentation } from "./present.js";

export type RoomHandlers = {
  onChooseGhost: (ghostId: string) => void;
  onChooseOption: (index: number) => void;
  onRetry: () => void;
  onRestart: () => void;
  onChangeGhost: () => void;
};

export type RoomView = {
  setState(state: RoomState): void;
  /** Keep the next line off the screen until the voice has had a moment. */
  holdLine(): void;
  releaseLine(): void;
  cancelHold(): void;
  /** After a short wait, show one shiver line while the opening voice is still out. */
  armOmen(): void;
};

const INSTRUCTION = "Blow into the microphone, or hold the left mouse button and bring it close.";
const FAREWELL = "The light startles it. The ghost is gone.";
const FAREWELL_MS = 4_200;
/** Long enough that a fast line never flashes it, short enough to land during a slow first voice. */
const OMEN_DELAY_MS = 2_200;
const LETTER_FADE_MS = 480;
const BURN_MS = 1_200;

export function mountRoomView(root: HTMLElement, handlers: RoomHandlers): RoomView {
  root.replaceChildren();

  const room = document.createElement("main");
  room.className = "room";
  room.dataset.lit = "true";

  const photo = document.createElement("div");
  photo.className = "photo";
  photo.setAttribute("aria-hidden", "true");

  const warmth = document.createElement("div");
  warmth.className = "warmth";
  warmth.setAttribute("aria-hidden", "true");

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.setAttribute("aria-live", "polite");

  const farewell = document.createElement("p");
  farewell.className = "farewell";
  farewell.setAttribute("role", "status");

  const omen = document.createElement("p");
  omen.className = "omen";
  omen.setAttribute("role", "status");

  const candleHost = document.createElement("div");
  candleHost.className = "candle-host";

  const instruction = document.createElement("p");
  instruction.className = "instruction";
  instruction.textContent = INSTRUCTION;

  const notice = document.createElement("p");
  notice.className = "notice";

  const choices = document.createElement("div");
  choices.className = "choices";

  const actions = document.createElement("div");
  actions.className = "actions";

  const lighter = document.createElement("button");
  lighter.type = "button";
  lighter.className = "lighter";
  lighter.setAttribute("aria-label", "Light the candle");
  lighter.hidden = true;
  const lighterIcon = document.createElement("img");
  lighterIcon.src = lighterUrl;
  lighterIcon.alt = "";
  lighterIcon.draggable = false;
  lighter.append(lighterIcon);
  const ambience = createRoomAmbience();

  const gust = document.createElement("div");
  gust.className = "gust";
  gust.hidden = true;
  gust.setAttribute("aria-hidden", "true");
  gust.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));

  room.append(photo, warmth, omen, subtitle, farewell, candleHost, notice, choices, actions, lighter, gust);
  root.append(room);

  const candle = mountCandle(candleHost);
  candleHost.append(instruction);
  let latest: RoomState | null = null;
  let presentation: RoomPresentation | null = null;
  let holding = false;
  let farewellTimer = 0;
  let omenTimer = 0;
  let summoned = false;
  let pendingSummon = false;
  let blowing = false;
  let pointer = { x: 0, y: 0 };
  let raf = 0;
  let micLeaning = false;
  const micTrack = createBlowTrack();
  const mic = createBlowListener((level) => {
    if (room.dataset.lit !== "true" || blowing) {
      micTrack.hardSince = null;
      return;
    }
    const now = performance.now();
    const breath = trackBlow(micTrack, level, now);
    if (!breath.blowing) {
      if (micLeaning) {
        candle.setLean(0, 0);
        micLeaning = false;
      }
      return;
    }
    micLeaning = true;
    const sway = Math.sin(now / 90);
    candle.setLean(sway * level * 36, Math.cos(now / 140) * level * 8);
    if (breath.extinguish) summon();
  });

  room.addEventListener("pointerdown", (event) => {
    ambience.start();
    void mic.start().catch(() => undefined);
    if (!event.isPrimary || event.button !== 0 || room.dataset.lit !== "true") return;
    if (event.target instanceof Element && event.target.closest("button")) return;
    blowing = true;
    pointer = { x: event.clientX, y: event.clientY };
    try {
      room.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is already gone cannot be captured. Moves still update the flame.
    }
    gust.hidden = false;
    schedule();
  });
  room.addEventListener("pointermove", (event) => {
    if (!blowing || !event.isPrimary) return;
    pointer = { x: event.clientX, y: event.clientY };
  });
  room.addEventListener("pointerup", (event) => {
    release(event.pointerId);
    stopWind();
  });
  room.addEventListener("pointercancel", (event) => {
    release(event.pointerId);
    stopWind();
  });
  room.addEventListener("lostpointercapture", stopWind);
  window.addEventListener("resize", () => placeGlow(candle, room));

  function release(pointerId: number): void {
    if (room.hasPointerCapture(pointerId)) room.releasePointerCapture(pointerId);
  }

  function stopWind(): void {
    blowing = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    gust.hidden = true;
    if (room.dataset.lit === "true") candle.setLean(0, 0);
  }

  function schedule(): void {
    if (raf) return;
    raf = requestAnimationFrame(tick);
  }

  function tick(): void {
    raf = 0;
    if (!blowing || room.dataset.lit !== "true") return;
    const wind = windFromCursor(candle.flamePoint(), pointer, true);
    candle.setLean(wind.lean, wind.shiftX);
    placeGlow(candle, room);
    gust.style.left = `${pointer.x}px`;
    gust.style.top = `${pointer.y}px`;
    gust.style.opacity = String(wind.closeness);
    gust.style.transform = `rotate(${wind.angle}rad)`;
    if (wind.extinguish) {
      summon();
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function summon(): void {
    if (summoned) return;
    summoned = true;
    pendingSummon = false;
    stopWind();
    hideFarewell();
    candle.setLit(false);
    room.dataset.lit = "false";
    playArrival();
    const ghosts = latest?.ghosts ?? [];
    const ghost = latest?.phase === "choose" ? pickGhost(ghosts) : null;
    if (ghost) {
      handlers.onChooseGhost(ghost.id);
      return;
    }
    pendingSummon = true;
  }

  function setState(state: RoomState): void {
    latest = state;
    if (state.phase === "choose" && state.ghost == null && pendingSummon && state.ghosts.length > 0) {
      pendingSummon = false;
      summoned = true;
      const ghost = pickGhost(state.ghosts);
      if (ghost) queueMicrotask(() => handlers.onChooseGhost(ghost.id));
    }
    const lit = !summoned && state.ghost == null;
    candle.setLit(lit);
    room.dataset.lit = lit ? "true" : "false";
    ambience.setLit(lit);
    if (lit) placeGlow(candle, room);

    presentation = presentRoom(state);
    room.setAttribute("aria-busy", state.phase === "loading" ? "true" : "false");
    paintNotice();
    paintLine();
    paintChoices();
    paintActions();
    lighter.hidden = lit;
  }

  function holdLine(): void {
    holding = true;
    subtitle.replaceChildren();
  }

  function releaseLine(): void {
    holding = false;
    clearOmen();
    paintNotice();
    paintLine();
    paintChoices();
    paintActions();
  }

  function cancelHold(): void {
    holding = false;
    clearOmen();
  }

  function armOmen(): void {
    window.clearTimeout(omenTimer);
    omen.textContent = "";
    omen.classList.remove("is-in");
    omenTimer = window.setTimeout(() => {
      if (!holding) return;
      omen.textContent = pickOmen();
      omen.classList.add("is-in");
    }, OMEN_DELAY_MS);
  }

  function clearOmen(): void {
    window.clearTimeout(omenTimer);
    omen.textContent = "";
    omen.classList.remove("is-in");
  }

  function paintNotice(): void {
    if (!presentation) return;
    const hidden = holding && presentation.noticeKind !== "error";
    const text = hidden ? null : presentation.notice;
    setText(notice, text);
    if (presentation.noticeKind === "error" && text) {
      notice.setAttribute("role", "alert");
      notice.dataset.kind = "error";
    } else {
      notice.setAttribute("role", "status");
      notice.dataset.kind = text ? "status" : "";
    }
  }

  function paintLine(): void {
    const text = presentation?.subtitle ?? null;
    if (!text || holding) {
      subtitle.replaceChildren();
      delete subtitle.dataset.spoken;
      return;
    }
    if (subtitle.dataset.spoken === text && subtitle.querySelector(".letter")) return;
    subtitle.dataset.spoken = text;
    subtitle.replaceChildren();
    let word = document.createElement("span");
    word.className = "word";
    let pending = false;
    for (const letter of captionLetters(text)) {
      if (letter.char === " " || letter.char === "\n") {
        if (pending) {
          subtitle.append(word);
          pending = false;
          word = document.createElement("span");
          word.className = "word";
        }
        subtitle.append(document.createTextNode(" "));
        continue;
      }
      pending = true;
      const span = document.createElement("span");
      span.className = "letter";
      span.textContent = letter.char;
      word.append(span);
      // Driven here, not by a stylesheet. A reduced-motion rule was cancelling
      // the CSS fade and a custom-property delay was not staggering the letters.
      span.animate(
        [
          { opacity: 0, filter: "blur(8px)" },
          { opacity: 1, filter: "blur(0px)" },
        ],
        { duration: LETTER_FADE_MS, delay: letter.delayMs, easing: "ease-out", fill: "both" },
      );
    }
    if (pending) subtitle.append(word);
  }

  function paintChoices(): void {
    if (!presentation) return;
    if (choices.dataset.burning === "true") return;
    if (holding && presentation.subtitle) {
      choices.replaceChildren();
      choices.setAttribute("role", "presentation");
      choices.removeAttribute("aria-label");
      return;
    }
    const buttons = presentation.choices
      .filter((button) => button.kind !== "ghost")
      .map((button) => renderChoice(button, handlers, relight, burnChoice));
    choices.replaceChildren(...buttons);
    choices.setAttribute("role", buttons.length > 0 ? "group" : "presentation");
    const label = choiceLabel(presentation);
    if (label && buttons.length > 0) choices.setAttribute("aria-label", label);
    else choices.removeAttribute("aria-label");
  }

  function paintActions(): void {
    if (!presentation) return;
    if (holding && presentation.subtitle) {
      actions.replaceChildren();
      return;
    }
    const kept = presentation.actions.filter((button) => button.kind === "retry");
    actions.replaceChildren(...kept.map((button) => renderAction(button, handlers, relight)));
  }

  function burnChoice(node: HTMLButtonElement, index: number): void {
    if (choices.dataset.burning === "true") return;
    const buttons = Array.from(choices.querySelectorAll("button"));
    const selected = buttons.indexOf(node);
    choices.dataset.burning = "true";
    buttons.forEach((button, i) => {
      button.setAttribute("aria-disabled", "true");
      button.classList.add("is-burning");
      const delay = Math.abs(i - selected) * 140;
      button.animate(paperBurnFrames(), {
        duration: BURN_MS,
        delay,
        easing: "ease-in",
        fill: "forwards",
      });
      const ember = document.createElement("span");
      ember.className = "ember-sheet";
      ember.setAttribute("aria-hidden", "true");
      button.append(ember);
      ember.animate(
        [
          { opacity: 0, transform: "translateY(55%)" },
          { opacity: 1, transform: "translateY(-10%)" },
        ],
        { duration: BURN_MS, delay, easing: "ease-out", fill: "forwards" },
      );
    });
    window.setTimeout(
      () => {
        choices.dataset.burning = "false";
        choices.replaceChildren();
        if (!holding) paintChoices();
      },
      BURN_MS + Math.max(buttons.length - 1, 0) * 140 + 40,
    );
    handlers.onChooseOption(index);
  }

  function playArrival(): void {
    const audio = new Audio(arrivalUrl);
    audio.volume = 0.55;
    void audio.play().catch(() => undefined);
  }

  function showFarewell(): void {
    farewell.textContent = FAREWELL;
    window.clearTimeout(farewellTimer);
    farewellTimer = window.setTimeout(() => {
      farewell.textContent = "";
    }, FAREWELL_MS);
  }

  function hideFarewell(): void {
    window.clearTimeout(farewellTimer);
    farewell.textContent = "";
  }

  function relight(): void {
    summoned = false;
    pendingSummon = false;
    candle.setLit(true);
    room.dataset.lit = "true";
    lighter.hidden = true;
    placeGlow(candle, room);
  }

  lighter.addEventListener("click", () => {
    relight();
    showFarewell();
    handlers.onChangeGhost();
  });

  return { setState, holdLine, releaseLine, cancelHold, armOmen };
}

function paperBurnFrames(): Keyframe[] {
  return [
    { opacity: 1, transform: "translateY(0) scale(1)", filter: "brightness(1) sepia(0)" },
    { opacity: 1, transform: "translateY(-8px) scale(1.03)", filter: "brightness(0.55) sepia(1)", offset: 0.35 },
    { opacity: 0, transform: "translateY(-42px) rotate(7deg) scale(0.84)", filter: "brightness(0.2) sepia(1)" },
  ];
}

function placeGlow(candle: CandleScene, room: HTMLElement): void {
  const point = candle.flamePoint();
  const rect = room.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const x = ((point.x - rect.left) / rect.width) * 100;
  const y = ((point.y - rect.top) / rect.height) * 100;
  room.style.setProperty("--gx", `${x}%`);
  room.style.setProperty("--gy", `${y}%`);
}

function choiceLabel(presentation: RoomPresentation): string | null {
  const first = presentation.choices.find((button) => button.kind === "option");
  return first ? "Replies" : null;
}

function renderChoice(
  button: RoomButton,
  handlers: RoomHandlers,
  relight: () => void,
  burnChoice: (node: HTMLButtonElement, index: number) => void,
): HTMLButtonElement {
  if (button.kind === "option") {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "option";
    node.dataset.optionIndex = String(button.index);
    node.textContent = button.text;
    node.addEventListener("click", () => burnChoice(node, button.index));
    return node;
  }
  return renderAction(button, handlers, relight);
}

function renderAction(button: RoomButton, handlers: RoomHandlers, relight: () => void): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "action";
  if (button.kind === "retry") {
    node.dataset.action = "retry";
    node.textContent = "Try again";
    node.addEventListener("click", () => handlers.onRetry());
    return node;
  }
  if (button.kind === "restart") {
    node.dataset.action = "restart";
    node.textContent = "Start again";
    node.addEventListener("click", () => handlers.onRestart());
    return node;
  }
  if (button.kind !== "change") {
    throw new Error(`Unexpected action ${button.kind}`);
  }
  node.dataset.action = "change";
  node.textContent = "Blow the candle again";
  node.addEventListener("click", () => {
    relight();
    handlers.onChangeGhost();
  });
  return node;
}

function setText(node: HTMLElement, text: string | null): void {
  node.textContent = text ?? "";
}
