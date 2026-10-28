import type { TtsProvider } from "./types.js";

/**
 * Open fallback. The interface is here so the app can select it; synthesis
 * lands with the candle scene. Kokoro can sit beside this later.
 */
export function createPiperProvider(): TtsProvider {
  return {
    id: "piper",
    async speak() {
      throw new Error(
        "Piper TTS is not implemented yet. Set TTS_PROVIDER=elevenlabs, or wait for the open fallback.",
      );
    },
  };
}
