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

/**
 * Post-process on the speech request. Ids come from ElevenLabs
 * `GET /v1/audio-effects/catalog`. Reverb needs `environment_id` and a
 * `send_level` above 0. `distance` is 0 (close) to 1 (far).
 */
export type VoiceEffects = {
  filter_preset_id?: string;
  environment_id?: string;
  background_noise_id?: string;
  /** 0–1. How far the voice sits from the listener. */
  distance?: number;
  /** 0–1. How much of the voice feeds the reverb. */
  send_level?: number;
  /** -1 (left) to 1 (right). */
  pan?: number;
};

export type VoiceConfig = {
  elevenlabs_voice_id?: string;
  /**
   * Overrides `ELEVENLABS_MODEL_ID` for this ghost.
   * `eleven_v3` and `eleven_v4` perform square-bracket audio tags.
   * Flash, Turbo, and Multilingual v2 speak the brackets as words.
   */
  model_id?: string;
  piper_model?: string;
  settings?: ElevenLabsVoiceSettings;
  effects?: VoiceEffects;
};

/** A public bond to another ghost. The bond is not that ghost's secret. */
export type GhostTie = {
  id: string;
  bond: string;
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
  ties?: GhostTie[];
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
