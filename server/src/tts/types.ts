import type { VoiceConfig } from "../types.js";

export interface TtsProvider {
  readonly id: string;
  speak(text: string, voice: VoiceConfig): Promise<ArrayBuffer>;
}
