import lighterUrl from "../assets/lighter.svg";
import { createRoomAmbience } from "../scene/ambience.js";
import { pickGhost, windFromCursor } from "../scene/blow.js";
import { mountCandle, type CandleScene } from "../scene/candle.js";
import { createBlowListener, createBlowTrack, trackBlow } from "../scene/mic.js";
import type { RoomState } from "../session/session.js";
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
};

const INSTRUCTION = "Blow into the microphone, or hold the left mouse button and bring it close.";

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

  room.append(photo, warmth, subtitle, candleHost, notice, choices, actions, lighter, gust);
  root.append(room);

  const candle = mountCandle(candleHost);
  candleHost.append(instruction);
  let latest: RoomState | null = null;
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
    candle.setLit(false);
    room.dataset.lit = "false";
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

    const presentation = presentRoom(state);
    room.setAttribute("aria-busy", state.phase === "loading" ? "true" : "false");
    setText(subtitle, presentation.subtitle);
    setText(notice, presentation.notice);
    if (presentation.noticeKind === "error") {
      notice.setAttribute("role", "alert");
      notice.dataset.kind = "error";
    } else {
      notice.setAttribute("role", "status");
      notice.dataset.kind = presentation.notice ? "status" : "";
    }
    const buttons = presentation.choices
      .filter((button) => button.kind !== "ghost")
      .map((button) => renderChoice(button, handlers, relight));
    choices.replaceChildren(...buttons);
    choices.setAttribute("role", buttons.length > 0 ? "group" : "presentation");
    const label = choiceLabel(presentation);
    if (label && buttons.length > 0) choices.setAttribute("aria-label", label);
    else choices.removeAttribute("aria-label");
    const kept = presentation.actions.filter((button) => button.kind === "retry");
    actions.replaceChildren(...kept.map((button) => renderAction(button, handlers, relight)));
    lighter.hidden = lit;
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
    handlers.onChangeGhost();
  });

  return { setState };
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

function renderChoice(button: RoomButton, handlers: RoomHandlers, relight: () => void): HTMLButtonElement {
  if (button.kind === "option") {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "option";
    node.dataset.optionIndex = String(button.index);
    node.textContent = button.text;
    node.addEventListener("click", () => handlers.onChooseOption(button.index));
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
