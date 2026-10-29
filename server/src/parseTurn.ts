import { LlmError } from "./errors.js";
import { buildMessages, REPAIR_INSTRUCTION } from "./prompt.js";
import type { ChatMessage, Ghost, GhostTurn, Turn } from "./types.js";

const MAX_LINE = 1200;

export function parseGhostTurn(raw: string, ghost: Ghost): GhostTurn | null {
  try {
    const value = extractJson(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.ghost_line !== "string") return null;
    const ghostLine = record.ghost_line.trim();
    if (!ghostLine || ghostLine.length > MAX_LINE) return null;
    const options = readOptions(record.options);
    if (!options) return null;
    const stage = record.reveal_stage;
    if (typeof stage !== "number" || !Number.isInteger(stage)) return null;
    if (stage < 0 || stage > ghost.reveal_stages) return null;
    return { ghost_line: ghostLine, options, reveal_stage: stage };
  } catch {
    return null;
  }
}

export async function completeGhostTurn(
  complete: (messages: ChatMessage[]) => Promise<string>,
  ghost: Ghost,
  history: Turn[],
): Promise<GhostTurn> {
  const messages = buildMessages(ghost, history);
  let raw = await complete(messages);
  let parsed = parseGhostTurn(raw, ghost);
  if (!parsed) {
    raw = await complete([
      ...messages,
      { role: "assistant", content: raw },
      { role: "user", content: REPAIR_INSTRUCTION },
    ]);
    parsed = parseGhostTurn(raw, ghost);
  }
  if (!parsed) {
    throw new LlmError(`Model did not return a valid ghost turn. Last reply: ${raw.slice(0, 500)}`);
  }
  return parsed;
}

function readOptions(value: unknown): [string, string] | null {
  if (Array.isArray(value) && value.length === 2) {
    const first = cleanOption(value[0]);
    const second = cleanOption(value[1]);
    if (first && second) return [first, second];
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const first = cleanOption(record.a);
    const second = cleanOption(record.b);
    if (first && second) return [first, second];
  }
  return null;
}

function cleanOption(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 400) return null;
  return trimmed;
}

function extractJson(raw: string): unknown {
  let text = raw.trim();
  text = text.replace(/<\|channel>thought[\s\S]*?<channel\|>/gi, "");
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  text = text.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end < start) {
    throw new Error("no json object");
  }
  return JSON.parse(text.slice(start, end + 1));
}
