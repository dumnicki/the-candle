import type { LlmProvider } from "./types.js";

/** Canned turn for smoke tests. Not a model, and not for the demo. */
export function createMockProvider(): LlmProvider {
  return {
    id: "mock",
    async nextTurn(ghost, history) {
      const playerTurns = history.filter((turn) => turn.role === "player").length;
      const revealStage = Math.min(ghost.reveal_stages, playerTurns + 1);
      return {
        ghost_line:
          history.length === 0
            ? ghost.opening_line
            : `${ghost.name} listens, and the room stays cold.`,
        options: ["Ask who they were", "Stay quiet and step back"],
        reveal_stage: revealStage,
      };
    },
  };
}
