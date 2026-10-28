import { RequestError } from "./errors.js";
import type { Turn } from "./types.js";

const MAX_TURNS = 40;
const MAX_TEXT = 2000;

export type TurnRequest = {
  ghostId: string;
  history: Turn[];
};

export function parseTurnRequest(body: unknown): TurnRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError("Body must be a JSON object");
  }
  const record = body as Record<string, unknown>;
  if (typeof record.ghostId !== "string" || !record.ghostId.trim()) {
    throw new RequestError("ghostId is required");
  }
  const history = record.history === undefined ? [] : parseHistory(record.history);
  return { ghostId: record.ghostId.trim(), history };
}

export function parseHistory(value: unknown): Turn[] {
  if (!Array.isArray(value)) throw new RequestError("history must be an array");
  if (value.length > MAX_TURNS) throw new RequestError(`history is limited to ${MAX_TURNS} turns`);
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new RequestError(`history[${index}] must be an object`);
    }
    const record = item as Record<string, unknown>;
    if (record.role !== "ghost" && record.role !== "player") {
      throw new RequestError(`history[${index}].role must be "ghost" or "player"`);
    }
    if (typeof record.text !== "string" || !record.text.trim()) {
      throw new RequestError(`history[${index}].text must be a non-empty string`);
    }
    if (record.text.length > MAX_TEXT) {
      throw new RequestError(`history[${index}].text is too long`);
    }
    return { role: record.role, text: record.text.trim() };
  });
}
