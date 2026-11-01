export type Turn = { role: "ghost" | "player"; text: string };

export type GhostTurn = {
  ghost_line: string;
  options: [string, string];
  reveal_stage: number;
  /** Set when Backboard created or continued a thread. */
  thread_id?: string;
};

/** Optional ElevenLabs delivery. Omitted fields use the provider default. */
export type ElevenLabsVoiceSettings = {
  /** 0–1. Lower is more expressive. */
  stability?: number;
  /** 0–1. Higher stays closer to the recorded voice. */
  similarity_boost?: number;
  /** 0–1. Used by multilingual v2. Flash and Turbo ignore it. */
  style?: number;
  /** 0.7–1.2. 1 is the voice's normal pace. */
  speed?: number;
  use_speaker_boost?: boolean;
};

export type VoiceConfig = {
  elevenlabs_voice_id?: string;
  piper_model?: string;
  settings?: ElevenLabsVoiceSettings;
};

export type Ghost = {
  id: string;
  name: string;
  era: string;
  personality: string;
  backstory: string;
  secret: string;
  opening_line: string;
  voice: VoiceConfig;
  reveal_stages: number;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
