import { Hono } from "hono";
import { cors } from "hono/cors";

import { GhostNotFoundError, RequestError } from "../errors.js";
import { loadGhost } from "../ghosts/ghosts.js";
import type { LlmProvider } from "../llm/types.js";
import { parseTurnRequest } from "./turnRequest.js";

export type AppDeps = {
  llm: LlmProvider;
  ghostsDir: string;
};

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.use("/api/*", cors());

  app.get("/health", (c) => c.json({ ok: true, llm: deps.llm.id }));

  app.post("/api/turn", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Request body must be JSON" }, 400);
    }

    try {
      const request = parseTurnRequest(body);
      const ghost = loadGhost(deps.ghostsDir, request.ghostId);
      const turn = await deps.llm.nextTurn(ghost, request.history, { threadId: request.thread_id });
      return c.json({
        ghost_line: turn.ghost_line,
        options: turn.options,
        reveal_stage: turn.reveal_stage,
        ...(turn.thread_id ? { thread_id: turn.thread_id } : {}),
      });
    } catch (error) {
      if (error instanceof RequestError) return c.json({ error: error.message }, 400);
      if (error instanceof GhostNotFoundError) return c.json({ error: error.message }, 404);
      const message = error instanceof Error ? error.message : "Turn failed";
      return c.json({ error: message }, 502);
    }
  });

  return app;
}
