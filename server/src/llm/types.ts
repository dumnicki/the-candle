import type { Ghost, GhostTurn, Turn } from "../types.js";

export interface LlmProvider {
  readonly id: string;
  nextTurn(ghost: Ghost, history: Turn[]): Promise<GhostTurn>;
}
