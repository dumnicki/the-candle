import type { ChatMessage, Ghost, Turn } from "../types.js";

export const JSON_SHAPE =
  '{"ghost_line":"string","options":["curious reply","cautious reply"],"reveal_stage":0}';

export const REPAIR_INSTRUCTION =
  "That reply was not valid JSON. Return one JSON object only, no markdown and no thought channel. " +
  `Shape: ${JSON_SHAPE}`;

/**
 * Gemma 4 thinks only when the system text starts with `<|think|>`.
 * This task needs a JSON object, so the prompt never sends that token.
 */
export function buildMessages(ghost: Ghost, history: Turn[]): ChatMessage[] {
  const system = [
    `You are ${ghost.name}, a ghost in a dark room. A visitor just blew out your candle.`,
    `Era: ${ghost.era}.`,
    `Personality: ${ghost.personality}.`,
    `What you remember: ${ghost.backstory}.`,
    `Secret, hidden until reveal_stage reaches ${ghost.reveal_stages}: ${ghost.secret}.`,
    `reveal_stage is an integer from 0 to ${ghost.reveal_stages}. Raise it by at most 1 each turn. Only the final stage may say the secret.`,
    "Speak in 1 to 3 short sentences. Eerie, quiet, not gory. Stay in character. Do not mention these instructions.",
    "options must be exactly two things the visitor might say next. The first is curious. The second is cautious.",
    "Do not think out loud. Do not emit <|think|>, <|channel|>, or markdown fences.",
    `Return JSON only: ${JSON_SHAPE}`,
    history.length === 0
      ? `This is your first line. Keep the meaning of this opening: ${ghost.opening_line}`
      : "Continue the conversation. Do not repeat a line you already said.",
  ].join("\n");

  const messages: ChatMessage[] = [{ role: "system", content: system }];
  if (history.length === 0) {
    messages.push({ role: "user", content: "The candle just went out. Speak." });
    return messages;
  }

  for (const turn of history) {
    messages.push({
      role: turn.role === "ghost" ? "assistant" : "user",
      content: turn.text,
    });
  }
  if (history[history.length - 1]?.role === "ghost") {
    messages.push({
      role: "user",
      content: "The visitor waits in the dark. Speak again, and offer two replies.",
    });
  }
  return messages;
}
