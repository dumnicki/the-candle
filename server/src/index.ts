import { existsSync } from "node:fs";
import path from "node:path";

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

import { loadProjectEnv } from "./config/env.js";
import { ghostsDir } from "./config/paths.js";
import { createApp } from "./http/app.js";
import { createLlmProvider } from "./llm/index.js";
import { createTtsProvider } from "./tts/index.js";

loadProjectEnv();

const llm = createLlmProvider(process.env);
const tts = createTtsProvider(process.env);
const app = createApp({ llm, tts, ghostsDir: ghostsDir() });
const port = Number(process.env.PORT) || 8787;
const hostname = process.env.HOST?.trim() || "0.0.0.0";

/** Relative to the process working directory. serveStatic refuses an absolute path. */
const webRoot = process.env.WEB_DIR?.trim() || "web/dist";
if (existsSync(path.resolve(webRoot, "index.html"))) {
  app.use("/*", serveStatic({ root: webRoot }));
}

if (tts.id === "elevenlabs" && !(process.env.ELEVENLABS_API_KEY ?? "").trim()) {
  console.warn("[tts] ELEVENLABS_API_KEY is not set. Ghost lines stay subtitles only.");
} else if (tts.id === "piper") {
  console.warn("[tts] Piper is still a stub. Ghost lines stay subtitles only.");
}

serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`Ghost in the Candle API on http://${hostname}:${port} (llm=${llm.id}, tts=${tts.id})`);
});
