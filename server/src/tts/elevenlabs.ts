import { setDefaultResultOrder } from "node:dns";

import { ElevenLabsClient, ElevenLabsError, ElevenLabsTimeoutError } from "@elevenlabs/elevenlabs-js";

import type { VoiceConfig } from "../types.js";
import type { TtsProvider } from "./types.js";

const DEFAULT_TIMEOUT_MS = 12_000;

// Node's resolver tries IPv6 first. On this machine that attempt sits until the
// abort fires, so the ghost line never arrives. Prefer IPv4 for later lookups.
try {
  setDefaultResultOrder("ipv4first");
} catch {
  // A lookup already ran. Leave the existing order in place.
}

export type ElevenLabsOptions = {
  apiKey: string;
  modelId: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export function createElevenLabsProvider(options: ElevenLabsOptions): TtsProvider {
  const timeoutMs = usableTimeout(options.timeoutMs);
  const client = new ElevenLabsClient({
    apiKey: options.apiKey,
    fetch: options.fetchImpl,
    timeoutInSeconds: timeoutMs / 1000,
    maxRetries: 0,
  });
  return {
    id: "elevenlabs",
    async speak(text, voice) {
      const voiceId = usableVoiceId(voice);
      if (!options.apiKey.trim()) throw new Error("ELEVENLABS_API_KEY is not set");
      const modelId = modelFor(voice, options.modelId);
      const settings = voiceSettings(voice, modelId);
      const effects = audioEffects(voice);
      try {
        const audio = await client.textToSpeech.convert(voiceId, {
          text,
          modelId,
          outputFormat: "mp3_44100_128",
          ...(settings ? { voiceSettings: settings } : {}),
          ...(effects ? { audioEffects: effects } : {}),
        });
        return readStream(audio);
      } catch (error) {
        if (isTimeout(error)) throw new Error(`ElevenLabs timed out after ${timeoutMs}ms`);
        if (error instanceof ElevenLabsError && error.statusCode != null) {
          throw new Error(`ElevenLabs ${error.statusCode}: ${errorDetail(error)}`.slice(0, 500));
        }
        throw error;
      }
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

function modelFor(voice: VoiceConfig, fallback: string): string {
  const chosen = voice.model_id?.trim();
  return chosen || fallback;
}

/** v3 and v4 pace with audio tags. Speed, style, and speaker boost are not part of that request. */
function tagsModel(modelId: string): boolean {
  return modelId === "eleven_v3" || modelId === "eleven_v4";
}

function voiceSettings(voice: VoiceConfig, modelId: string): {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  useSpeakerBoost?: boolean;
} | undefined {
  const settings = voice.settings;
  if (!settings) return undefined;
  const picked: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
    useSpeakerBoost?: boolean;
  } = {};
  if (settings.stability != null) picked.stability = settings.stability;
  if (settings.similarity_boost != null) picked.similarityBoost = settings.similarity_boost;
  if (settings.style != null) picked.style = settings.style;
  if (settings.speed != null) picked.speed = settings.speed;
  if (settings.use_speaker_boost != null) picked.useSpeakerBoost = settings.use_speaker_boost;
  if (tagsModel(modelId)) {
    delete picked.speed;
    delete picked.style;
    delete picked.useSpeakerBoost;
  }
  return Object.keys(picked).length > 0 ? picked : undefined;
}

function audioEffects(voice: VoiceConfig): {
  filterPresetId?: string;
  environmentId?: string;
  backgroundNoiseId?: string;
  distance?: number;
  sendLevel?: number;
  pan?: number;
} | undefined {
  const effects = voice.effects;
  if (!effects) return undefined;
  const spec: {
    filterPresetId?: string;
    environmentId?: string;
    backgroundNoiseId?: string;
    distance?: number;
    sendLevel?: number;
    pan?: number;
  } = {};
  if (effects.filter_preset_id) spec.filterPresetId = effects.filter_preset_id;
  if (effects.environment_id) spec.environmentId = effects.environment_id;
  if (effects.background_noise_id) spec.backgroundNoiseId = effects.background_noise_id;
  if (effects.distance != null) spec.distance = effects.distance;
  if (effects.send_level != null) spec.sendLevel = effects.send_level;
  if (effects.pan != null) spec.pan = effects.pan;
  return Object.keys(spec).length > 0 ? spec : undefined;
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    total += value.byteLength;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

function errorDetail(error: ElevenLabsError): string {
  if (typeof error.body === "string") return error.body;
  if (error.body == null) return error.message;
  return JSON.stringify(error.body);
}

function isTimeout(error: unknown): boolean {
  if (error instanceof ElevenLabsTimeoutError) return true;
  if (!error || typeof error !== "object") return false;
  if ("name" in error) {
    const name = String(error.name);
    if (name === "TimeoutError" || name === "AbortError") return true;
  }
  if ("cause" in error && error.cause !== error) return isTimeout(error.cause);
  return false;
}
