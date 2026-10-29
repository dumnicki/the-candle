import { serve } from "@hono/node-server";

import { loadProjectEnv } from "./config/env.js";
import { ghostsDir } from "./config/paths.js";
import { createApp } from "./http/app.js";
import { createLlmProvider } from "./llm/index.js";
import { createTtsProvider } from "./tts/index.js";

loadProjectEnv();

const llm = createLlmProvider(process.env);
const tts = createTtsProvider(process.env);
const app = createApp({ llm, ghostsDir: ghostsDir() });
const port = Number(process.env.PORT) || 8787;

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => {
  console.log(`Ghost in the Candle API on http://127.0.0.1:${port} (llm=${llm.id}, tts=${tts.id})`);
});
