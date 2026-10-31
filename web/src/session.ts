import type { GhostChoice, HistoryEntry, TurnRequest, TurnResult } from "./types";

export type RoomPhase = "choose" | "loading" | "line" | "error";

export type Pending =
  | { kind: "catalog" }
  | { kind: "turn"; request: TurnRequest };

export type RoomState = {
  phase: RoomPhase;
  ghosts: GhostChoice[];
  ghost: GhostChoice | null;
  history: HistoryEntry[];
  ghostLine: string | null;
  options: string[];
  revealStage: number | null;
  threadId: string | undefined;
  error: string | null;
  pending: Pending | null;
};

export function createRoomState(): RoomState {
  return {
    phase: "loading",
    ghosts: [],
    ghost: null,
    history: [],
    ghostLine: null,
    options: [],
    revealStage: null,
    threadId: undefined,
    error: null,
    pending: { kind: "catalog" },
  };
}

export function catalogSucceeded(state: RoomState, ghosts: GhostChoice[]): RoomState {
  return {
    ...state,
    phase: "choose",
    ghosts: ghosts.map((ghost) => ({ ...ghost })),
    error: null,
    pending: null,
  };
}

export function catalogFailed(state: RoomState, message: string): RoomState {
  return {
    ...state,
    phase: "error",
    error: message,
    pending: { kind: "catalog" },
  };
}

export function markCatalogLoading(state: RoomState): RoomState {
  return {
    ...state,
    phase: "loading",
    error: null,
    pending: { kind: "catalog" },
  };
}

export function markTurnLoading(state: RoomState): RoomState {
  if (state.pending?.kind !== "turn") return state;
  return { ...state, phase: "loading", error: null };
}

export function requestOpening(
  state: RoomState,
  ghostId: string,
): { state: RoomState; request: TurnRequest } | null {
  const ghost = state.ghosts.find((item) => item.id === ghostId);
  if (!ghost) return null;
  const request: TurnRequest = { ghostId: ghost.id, history: [] };
  return {
    request,
    state: {
      ...state,
      phase: "loading",
      ghost: { ...ghost },
      history: [],
      ghostLine: null,
      options: [],
      revealStage: null,
      threadId: undefined,
      error: null,
      pending: { kind: "turn", request },
    },
  };
}

export function requestChoice(
  state: RoomState,
  optionIndex: number,
): { state: RoomState; request: TurnRequest } | null {
  if (state.phase !== "line" || !state.ghost || state.ghostLine == null) return null;
  const option = state.options[optionIndex];
  if (option == null) return null;
  const history: HistoryEntry[] = [
    ...state.history,
    { role: "ghost", text: state.ghostLine },
    { role: "player", text: option },
  ];
  const request: TurnRequest = {
    ghostId: state.ghost.id,
    history,
    ...(state.threadId ? { thread_id: state.threadId } : {}),
  };
  return {
    request,
    state: {
      ...state,
      phase: "loading",
      history,
      options: [],
      error: null,
      pending: { kind: "turn", request },
    },
  };
}

export function restartGhost(state: RoomState): { state: RoomState; request: TurnRequest } | null {
  if (!state.ghost) return null;
  return requestOpening(state, state.ghost.id);
}

export function returnToChooser(state: RoomState): RoomState {
  return {
    ...state,
    phase: "choose",
    ghost: null,
    history: [],
    ghostLine: null,
    options: [],
    revealStage: null,
    threadId: undefined,
    error: null,
    pending: null,
  };
}

export function turnSucceeded(state: RoomState, turn: TurnResult): RoomState {
  return {
    ...state,
    phase: "line",
    ghostLine: turn.ghost_line,
    options: [...turn.options],
    revealStage: turn.reveal_stage,
    threadId: turn.thread_id ?? state.threadId,
    error: null,
    pending: null,
  };
}

export function turnFailed(state: RoomState, message: string): RoomState {
  return {
    ...state,
    phase: "error",
    error: message,
  };
}
