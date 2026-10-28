import type { VoiceConfig } from "../types.js";
import type { TtsProvider } from "./types.js";

export type ElevenLabsOptions = {
  apiKey: string;
  modelId: string;
  fetchImpl?: typeof fetch;
};

export function createElevenLabsProvider(options: ElevenLabsOptions): TtsProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    id: "elevenlabs",
    async speak(text, voice) {
      const voiceId = usableVoiceId(voice);
      if (!options.apiKey.trim()) throw new Error("ELEVENLABS_API_KEY is not set");
      const response = await fetchImpl(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": options.apiKey.trim(),
            "content-type": "application/json",
            accept: "audio/mpeg",
          },
          body: JSON.stringify({ text, model_id: options.modelId }),
        },
      );
      if (!response.ok) {
        throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 500)}`);
      }
      return response.arrayBuffer();
    },
  };
}

function usableVoiceId(voice: VoiceConfig): string {
  const voiceId = voice.elevenlabs_voice_id?.trim();
  if (!voiceId || voiceId === "TBD") {
    throw new Error("Ghost voice.elevenlabs_voice_id is not set");
  }
  return voiceId;
}
