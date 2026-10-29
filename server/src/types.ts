export type Turn = { role: "ghost" | "player"; text: string };

export type GhostTurn = {
  ghost_line: string;
  options: [string, string];
  reveal_stage: number;
  /** Set when Backboard created or continued a thread. */
  thread_id?: string;
};

export type VoiceConfig = {
  elevenlabs_voice_id?: string;
  piper_model?: string;
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
