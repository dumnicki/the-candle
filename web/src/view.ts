import { mountCandle } from "./candle";
import { presentRoom, type RoomButton, type RoomPresentation } from "./present";
import type { RoomState } from "./session";

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

export function mountRoomView(root: HTMLElement, handlers: RoomHandlers): RoomView {
  root.replaceChildren();

  const room = document.createElement("main");
  room.className = "room";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Ghost in the Candle";

  const candleHost = document.createElement("div");
  candleHost.className = "candle-host";

  const title = document.createElement("h1");
  title.className = "title";

  const meta = document.createElement("p");
  meta.className = "meta";

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.setAttribute("aria-live", "polite");

  const reveal = document.createElement("p");
  reveal.className = "reveal";

  const notice = document.createElement("p");
  notice.className = "notice";

  const choices = document.createElement("div");
  choices.className = "choices";

  const actions = document.createElement("div");
  actions.className = "actions";

  room.append(eyebrow, candleHost, title, meta, subtitle, reveal, notice, choices, actions);
  root.append(room);
  mountCandle(candleHost);

  function setState(state: RoomState): void {
    const presentation = presentRoom(state);
    room.setAttribute("aria-busy", state.phase === "loading" ? "true" : "false");
    title.textContent = presentation.title;
    setText(meta, presentation.era);
    setText(subtitle, presentation.subtitle);
    setText(reveal, presentation.reveal);
    setText(notice, presentation.notice);
    if (presentation.noticeKind === "error") {
      notice.setAttribute("role", "alert");
      notice.dataset.kind = "error";
    } else {
      notice.setAttribute("role", "status");
      notice.dataset.kind = presentation.notice ? "status" : "";
    }
    const buttons = presentation.choices.map((button) => renderChoice(button, handlers));
    choices.replaceChildren(...buttons);
    choices.setAttribute("role", buttons.length > 0 ? "group" : "presentation");
    const label = choiceLabel(presentation);
    if (label) choices.setAttribute("aria-label", label);
    else choices.removeAttribute("aria-label");
    actions.replaceChildren(...presentation.actions.map((button) => renderAction(button, handlers)));
    applyReveal(room, state.revealStage);
  }

  return { setState };
}

function choiceLabel(presentation: RoomPresentation): string | null {
  const first = presentation.choices[0];
  if (!first) return null;
  if (first.kind === "ghost") return "Ghosts";
  if (first.kind === "option") return "Replies";
  return null;
}

function renderChoice(button: RoomButton, handlers: RoomHandlers): HTMLButtonElement {
  if (button.kind === "ghost") {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "choice";
    node.dataset.ghostId = button.id;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = button.name;
    const era = document.createElement("span");
    era.className = "era";
    era.textContent = button.era;
    node.append(name, era);
    node.addEventListener("click", () => handlers.onChooseGhost(button.id));
    return node;
  }
  if (button.kind === "option") {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "option";
    node.dataset.optionIndex = String(button.index);
    node.textContent = button.text;
    node.addEventListener("click", () => handlers.onChooseOption(button.index));
    return node;
  }
  return renderAction(button, handlers);
}

function renderAction(button: RoomButton, handlers: RoomHandlers): HTMLButtonElement {
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
  node.textContent = "Choose another ghost";
  node.addEventListener("click", () => handlers.onChangeGhost());
  return node;
}

function setText(node: HTMLElement, text: string | null): void {
  node.textContent = text ?? "";
}

function applyReveal(room: HTMLElement, stage: number | null): void {
  if (stage == null) {
    room.style.setProperty("--reveal", "0");
    room.removeAttribute("data-reveal");
    return;
  }
  const shown = Math.max(0, Math.min(stage, 8));
  room.style.setProperty("--reveal", String(shown));
  room.dataset.reveal = String(shown);
}
