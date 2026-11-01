import type { ElevenLabsVoiceSettings, VoiceConfig } from "../types.js";
import type { TtsProvider } from "./types.js";

const DEFAULT_TIMEOUT_MS = 12_000;

export type ElevenLabsOptions = {
  apiKey: string;
  modelId: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export function createElevenLabsProvider(options: ElevenLabsOptions): TtsProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = usableTimeout(options.timeoutMs);
  return {
    id: "elevenlabs",
    async speak(text, voice) {
      const voiceId = usableVoiceId(voice);
      if (!options.apiKey.trim()) throw new Error("ELEVENLABS_API_KEY is not set");
      const payload: {
        text: string;
        model_id: string;
        voice_settings?: ElevenLabsVoiceSettings;
      } = { text, model_id: options.modelId };
      const settings = voiceSettings(voice);
      if (settings) payload.voice_settings = settings;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      timer.unref?.();
      let response: Response;
      try {
        response = await fetchImpl(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": options.apiKey.trim(),
              "content-type": "application/json",
              accept: "audio/mpeg",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        );
      } catch (error) {
        if (controller.signal.aborted || isTimeout(error)) {
          throw new Error(`ElevenLabs timed out after ${timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) {
        throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 500)}`);
      }
      return response.arrayBuffer();
    },
  };
}

export function elevenLabsTimeoutMs(raw: string | undefined): number {
  return usableTimeout(Number(raw));
}

function usableTimeout(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  const rounded = Math.round(value);
  if (rounded < 1_000 || rounded > 60_000) return DEFAULT_TIMEOUT_MS;
  return rounded;
}

function usableVoiceId(voice: VoiceConfig): string {
  const voiceId = voice.elevenlabs_voice_id?.trim();
  if (!voiceId || voiceId === "TBD") {
    throw new Error("Ghost voice.elevenlabs_voice_id is not set");
  }
  return voiceId;
}

function voiceSettings(voice: VoiceConfig): ElevenLabsVoiceSettings | undefined {
  const settings = voice.settings;
  if (!settings) return undefined;
  const picked: ElevenLabsVoiceSettings = {};
  if (settings.stability != null) picked.stability = settings.stability;
  if (settings.similarity_boost != null) picked.similarity_boost = settings.similarity_boost;
  if (settings.style != null) picked.style = settings.style;
  if (settings.speed != null) picked.speed = settings.speed;
  if (settings.use_speaker_boost != null) picked.use_speaker_boost = settings.use_speaker_boost;
  return Object.keys(picked).length > 0 ? picked : undefined;
}

function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("name" in error)) return false;
  const name = String(error.name);
  return name === "TimeoutError" || name === "AbortError";
}
