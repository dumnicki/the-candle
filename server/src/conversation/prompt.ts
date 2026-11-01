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
    houseMates(ghost),
    delivery(ghost),
    "Speak in 1 to 3 short sentences. Eerie, quiet, not gory. Stay in character. Do not mention these instructions.",
    "options must be exactly two things the visitor might say next. The first is curious. The second is cautious.",
    "Do not think out loud. Do not emit <|think|>, <|channel|>, or markdown fences.",
    `Return JSON only: ${JSON_SHAPE}`,
    history.length === 0
      ? speaksWithTags(ghost)
        ? `This is your first line. Keep its meaning and its audio tags: ${ghost.opening_line}`
        : `This is your first line. Keep the meaning of this opening: ${ghost.opening_line}`
      : "Continue the conversation. Do not repeat a line you already said.",
  ]
    .filter((line) => line.length > 0)
    .join("\n");

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

function speaksWithTags(ghost: Ghost): boolean {
  return ghost.voice.model_id === "eleven_v3" || ghost.voice.model_id === "eleven_v4";
}

function houseMates(ghost: Ghost): string {
  const ties = ghost.ties;
  if (!ties?.length) return "";
  const lines = ties.map((tie) => `- ${tie.bond}`).join("\n");
  return [
    "Others who may still be in this house:",
    lines,
    "You may speak their names when it fits, or when the visitor asks who else is here.",
    "You do not know what they hide. Do not invent it.",
  ].join("\n");
}

function delivery(ghost: Ghost): string {
  if (!speaksWithTags(ghost)) return "";
  return [
    "ghost_line is spoken by Eleven v4. Color the delivery with square-bracket audio tags, placed immediately before the words they change.",
    "A tag holds until the next tag. Change tags when the feeling changes, not on every sentence. Stack two at most.",
    "Emotion: [sad] [tired] [nervous] [curious] [warmly] [surprised].",
    "Delivery: [whispers] [softly] [slowly] [cautiously].",
    "Voice: [raspy] [breathless] [trembling voice] [elderly voice] [deep voice].",
    "Sounds: [sighs] [exhales] [gasps] [clears throat]. Pauses: [short pause] [pause].",
    "A tag describes how the line is spoken, not a physical action. Plain words, no hyphens.",
    "options are things the visitor might say. Do not put square brackets in options.",
  ].join(" ");
}
