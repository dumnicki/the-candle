import { type RoomState } from "./session";

export type RoomButton =
  | { kind: "ghost"; id: string; name: string; era: string }
  | { kind: "option"; index: number; text: string }
  | { kind: "retry" }
  | { kind: "restart" }
  | { kind: "change" };

export type RoomPresentation = {
  title: string;
  era: string | null;
  subtitle: string | null;
  reveal: string | null;
  notice: string | null;
  noticeKind: "status" | "error" | null;
  choices: RoomButton[];
  actions: RoomButton[];
};

export function revealLabel(stage: number | null, stages: number | null): string | null {
  if (stage == null) return null;
  if (stages != null && stages > 0) return `Reveal ${stage} of ${stages}`;
  return `Reveal ${stage}`;
}

export function presentRoom(state: RoomState): RoomPresentation {
  if (state.phase === "choose") {
    const empty = state.ghosts.length === 0;
    return {
      title: "Who will you speak with?",
      era: null,
      subtitle: null,
      reveal: null,
      notice: empty ? "The house has no ghosts yet." : null,
      noticeKind: empty ? "status" : null,
      choices: state.ghosts.map((ghost) => ({
        kind: "ghost",
        id: ghost.id,
        name: ghost.name,
        era: ghost.era,
      })),
      actions: [],
    };
  }

  if (state.phase === "loading" && !state.ghost) {
    return blankLoading();
  }

  const visiting = visitorFields(state);
  const actions: RoomButton[] = [];
  if (canRestart(state)) actions.push({ kind: "restart" });
  if (canChange(state)) actions.push({ kind: "change" });

  if (state.phase === "loading") {
    return {
      ...visiting,
      notice: "The dark shifts.",
      noticeKind: "status",
      choices: [],
      actions,
    };
  }

  if (state.phase === "error") {
    const errorActions: RoomButton[] = [];
    if (state.pending) errorActions.push({ kind: "retry" });
    errorActions.push(...actions);
    return {
      ...visiting,
      title: state.ghost?.name ?? "The candle gutters.",
      notice: state.error ?? "Something went quiet.",
      noticeKind: "error",
      choices: [],
      actions: errorActions,
    };
  }

  const choices: RoomButton[] = state.options.map((text, index) => ({
    kind: "option",
    index,
    text,
  }));
  return {
    ...visiting,
    notice: choices.length === 0 ? "The ghost offers nothing more to say." : null,
    noticeKind: choices.length === 0 ? "status" : null,
    choices,
    actions,
  };
}

function blankLoading(): RoomPresentation {
  return {
    title: "The room is waiting.",
    era: null,
    subtitle: null,
    reveal: null,
    notice: "Listening at the door.",
    noticeKind: "status",
    choices: [],
    actions: [],
  };
}

function visitorFields(state: RoomState): Pick<RoomPresentation, "title" | "era" | "subtitle" | "reveal"> {
  return {
    title: state.ghost?.name ?? "The room is waiting.",
    era: state.ghost?.era ?? null,
    subtitle: state.ghostLine,
    reveal: revealLabel(state.revealStage, state.ghost?.reveal_stages ?? null),
  };
}

function canRestart(state: RoomState): boolean {
  return state.ghost != null && (state.history.length > 0 || state.ghostLine != null);
}

function canChange(state: RoomState): boolean {
  return state.ghosts.length > 0 && state.ghost != null;
}
