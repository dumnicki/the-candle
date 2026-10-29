import type { Ghost, GhostTurn, Turn } from "../types.js";

export type TurnContext = {
  /** Backboard thread to continue. Omit to start a new one. */
  threadId?: string;
};

export interface LlmProvider {
  readonly id: string;
  nextTurn(ghost: Ghost, history: Turn[], context?: TurnContext): Promise<GhostTurn>;
}
