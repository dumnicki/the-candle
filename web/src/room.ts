import { ApiError, createApiClient, type ApiClient } from "./api";
import { mountRoomView, type RoomView } from "./view";
import { createGhostLineSpeaker, playGhostLine, type GhostLineSpeaker } from "./speech";
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
} from "./session";
import type { TurnRequest } from "./types";

export type StartRoomOptions = {
  root: HTMLElement;
  api?: ApiClient;
  speaker?: GhostLineSpeaker;
};

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
      const ticket = nextTicket();
      if (pending.kind === "catalog") {
        state = markCatalogLoading(state);
        view.setState(state);
        void loadCatalog(ticket);
        return;
      }
      state = markTurnLoading(state);
      view.setState(state);
      void runTurn(pending.request, ticket);
    },
    onRestart: () => {
      const next = restartGhost(state);
      if (!next) return;
      speaker.stop();
      beginTurn(next.state, next.request);
    },
    onChangeGhost: () => {
      nextTicket();
      speaker.stop();
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
    view.setState(state);
    void runTurn(request, ticket);
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

  async function runTurn(request: TurnRequest, ticket: number): Promise<void> {
    try {
      const turn = await api.sendTurn(request);
      if (ticket !== generation) return;
      state = turnSucceeded(state, turn);
      view.setState(state);
      void playGhostLine(speaker, turn.ghost_line).catch(() => undefined);
    } catch (error) {
      if (ticket !== generation) return;
      state = turnFailed(state, failureMessage(error));
      view.setState(state);
    }
  }
}

function failureMessage(error: unknown): string {
  if (error instanceof ApiError && error.message.trim()) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The candle could not reach the house.";
}
