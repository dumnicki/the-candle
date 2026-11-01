import { createElevenLabsProvider, elevenLabsTimeoutMs } from "./elevenlabs.js";
import { createPiperProvider } from "./piper.js";
import type { TtsProvider } from "./types.js";

export function createTtsProvider(
  env: NodeJS.ProcessEnv,
  deps: { fetchImpl?: typeof fetch } = {},
): TtsProvider {
  const choice = (env.TTS_PROVIDER ?? "elevenlabs").trim().toLowerCase();
  switch (choice) {
    case "elevenlabs":
      return createElevenLabsProvider({
        apiKey: env.ELEVENLABS_API_KEY ?? "",
        modelId: env.ELEVENLABS_MODEL_ID?.trim() || "eleven_flash_v2_5",
        timeoutMs: elevenLabsTimeoutMs(env.ELEVENLABS_TIMEOUT_MS),
        fetchImpl: deps.fetchImpl,
      });
    case "piper":
      return createPiperProvider();
    default:
      throw new Error(`Unknown TTS_PROVIDER "${choice}". Use elevenlabs or piper.`);
  }
}

export type { TtsProvider } from "./types.js";
