import { ApiError, createApiClient, type ApiClient } from "./api/api.js";
import { mountRoomView, type RoomView } from "./ui/view.js";
import { createGhostLineSpeaker, playGhostLine, type GhostLineSpeaker } from "./speech/speech.js";
import {
  catalogFailed,
  catalogSucceeded,
  createRoomState,
  markCatalogLoading,
  markTurnLoading,
  requestChoice,
  requestOpening,
  restartGhost,
  returnToChooser,
  turnFailed,
  turnSucceeded,
  type RoomState,
} from "./session/session.js";
import type { TurnRequest } from "./types";

export type StartRoomOptions = {
  root: HTMLElement;
  api?: ApiClient;
  speaker?: GhostLineSpeaker;
};

/** Long enough for the pool of candlelight to close. */
const OPENING_HOLD_MS = 4_200;
/** Long enough for a chosen scrap of paper to catch. */
const REPLY_HOLD_MS = 1_200;

export function startRoom(options: StartRoomOptions): void {
  const api = options.api ?? createApiClient();
  const speaker = options.speaker ?? createGhostLineSpeaker();
  let state: RoomState = createRoomState();
  let generation = 0;

  const view: RoomView = mountRoomView(options.root, {
    onChooseGhost: (ghostId) => {
      const next = requestOpening(state, ghostId);
      if (!next) return;
      beginTurn(next.state, next.request);
    },
    onChooseOption: (index) => {
      const next = requestChoice(state, index);
      if (!next) return;
      beginTurn(next.state, next.request);
    },
    onRetry: () => {
      const pending = state.pending;
      if (!pending) return;
      if (pending.kind === "catalog") {
        const ticket = nextTicket();
        state = markCatalogLoading(state);
        view.setState(state);
        void loadCatalog(ticket);
        return;
      }
      state = markTurnLoading(state);
      beginTurn(state, pending.request);
    },
    onRestart: () => {
      const next = restartGhost(state);
      if (!next) return;
      beginTurn(next.state, next.request);
    },
    onChangeGhost: () => {
      nextTicket();
      speaker.stop();
      view.cancelHold();
      state = returnToChooser(state);
      view.setState(state);
    },
  });

  view.setState(state);
  void loadCatalog(generation);

  function beginTurn(next: RoomState, request: TurnRequest): void {
    const ticket = nextTicket();
    speaker.stop();
    state = next;
    const ghostId = state.ghost?.id;
    const opening = request.history.length === 0 && ghostId != null;
    view.holdLine();
    if (opening) view.armOmen();
    view.setState(state);
    const started = performance.now();
    // Stop first. A fetch started before stop() is aborted, and the opening
    // has to leave with the breath that put the candle out.
    const voice = opening && ghostId ? speaker.speakOpening(ghostId) : null;
    void runTurn(request, ticket, voice, started, opening ? OPENING_HOLD_MS : REPLY_HOLD_MS);
  }

  function nextTicket(): number {
    generation += 1;
    return generation;
  }

  async function loadCatalog(ticket: number): Promise<void> {
    try {
      const ghosts = await api.listGhosts();
      if (ticket !== generation) return;
      state = catalogSucceeded(state, ghosts);
    } catch (error) {
      if (ticket !== generation) return;
      state = catalogFailed(state, failureMessage(error));
    }
    view.setState(state);
  }

  async function runTurn(
    request: TurnRequest,
    ticket: number,
    voice: Promise<void> | null,
    started: number,
    holdMs: number,
  ): Promise<void> {
    try {
      const turn = await api.sendTurn(request);
      if (ticket !== generation) return;
      state = turnSucceeded(state, turn);
      view.setState(state);
      const ghostId = state.ghost?.id;
      // The opening is already on its way to ElevenLabs. A second request
      // would throw away that wait. Later lines start the moment the text exists.
      const spoken =
        voice ??
        (state.phase === "line" && ghostId
          ? playGhostLine(speaker, turn.ghost_line, ghostId)
          : Promise.resolve());
      await spoken.catch(() => undefined);
      if (ticket !== generation) return;
      const remain = holdMs - (performance.now() - started);
      if (remain > 0) await delay(remain);
      if (ticket !== generation) return;
      view.releaseLine();
    } catch (error) {
      if (ticket !== generation) return;
      speaker.stop();
      view.cancelHold();
      state = turnFailed(state, failureMessage(error));
      view.setState(state);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function failureMessage(error: unknown): string {
  if (error instanceof ApiError && error.message.trim()) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The candle could not reach the house.";
}
