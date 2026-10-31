export type HistoryEntry = {
  role: "ghost" | "player";
  text: string;
};

/** Public ghost facts from GET /api/ghosts. */
export type GhostChoice = {
  id: string;
  name: string;
  era: string;
  reveal_stages: number;
};

export type TurnResult = {
  ghost_line: string;
  options: string[];
  reveal_stage: number;
  thread_id?: string;
};

export type TurnRequest = {
  ghostId: string;
  history: HistoryEntry[];
  thread_id?: string;
};
