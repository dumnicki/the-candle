import { Hono } from "hono";
import { cors } from "hono/cors";

import { GhostNotFoundError, RequestError } from "../errors.js";
import { listGhosts, loadGhost } from "../ghosts/ghosts.js";
import type { LlmProvider } from "../llm/types.js";
import type { TtsProvider } from "../tts/types.js";
import { parseTtsRequest } from "./ttsRequest.js";
import { parseTurnRequest } from "./turnRequest.js";

export type AppDeps = {
  llm: LlmProvider;
  tts: TtsProvider;
  ghostsDir: string;
};

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.use("/api/*", cors());

  app.get("/health", (c) => c.json({ ok: true, llm: deps.llm.id, tts: deps.tts.id }));

  app.get("/api/ghosts", (c) => {
    try {
      return c.json({ ghosts: listGhosts(deps.ghostsDir) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not list ghosts";
      return c.json({ error: message }, 500);
    }
  });

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

  app.post("/api/tts", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Request body must be JSON" }, 400);
    }

    let request: ReturnType<typeof parseTtsRequest>;
    try {
      request = parseTtsRequest(body);
    } catch (error) {
      if (error instanceof RequestError) return c.json({ error: error.message }, 400);
      const message = error instanceof Error ? error.message : "Invalid speech request";
      return c.json({ error: message }, 400);
    }

    try {
      const ghost = loadGhost(deps.ghostsDir, request.ghostId);
      const text = request.opening ? ghost.opening_line : request.text;
      if (!text) throw new RequestError("text must be a non-empty string");
      const audio = await deps.tts.speak(text, ghost.voice);
      if (audio.byteLength === 0) {
        logSpeechSkipped(request.ghostId, "ElevenLabs returned empty audio");
        return c.body(null, 204);
      }
      return c.body(new Uint8Array(audio), 200, {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      });
    } catch (error) {
      if (error instanceof GhostNotFoundError) return c.json({ error: error.message }, 404);
      logSpeechSkipped(request.ghostId, error);
      return c.body(null, 204);
    }
  });

  return app;
}

function logSpeechSkipped(ghostId: string, error: unknown): void {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Speech failed";
  console.warn(`[tts] ${ghostId}: ${message}. The line stays on screen.`);
}
