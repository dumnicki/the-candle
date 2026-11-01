import { serve } from "@hono/node-server";

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

if (tts.id === "elevenlabs" && !(process.env.ELEVENLABS_API_KEY ?? "").trim()) {
  console.warn("[tts] ELEVENLABS_API_KEY is not set. Ghost lines stay subtitles only.");
} else if (tts.id === "piper") {
  console.warn("[tts] Piper is still a stub. Ghost lines stay subtitles only.");
}

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => {
  console.log(`Ghost in the Candle API on http://127.0.0.1:${port} (llm=${llm.id}, tts=${tts.id})`);
});
