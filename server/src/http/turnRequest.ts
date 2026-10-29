import { z } from "zod";

import { RequestError } from "../errors.js";
import type { Turn } from "../types.js";

const MAX_TURNS = 40;
const MAX_TEXT = 2000;

const historyItemSchema = z.object({
  role: z.enum(["ghost", "player"], 'role must be "ghost" or "player"'),
  text: z
    .string("text must be a non-empty string")
    .trim()
    .min(1, "text must be a non-empty string")
    .max(MAX_TEXT, "text is too long"),
});

const turnRequestSchema = z.object({
  ghostId: z.string("ghostId is required").trim().min(1, "ghostId is required"),
  history: z
    .array(historyItemSchema, "history must be an array")
    .max(MAX_TURNS, `history is limited to ${MAX_TURNS} turns`)
    .default([]),
  thread_id: z.string().trim().min(1, "thread_id must be a non-empty string").optional(),
});

export type TurnRequest = {
  ghostId: string;
  history: Turn[];
  thread_id?: string;
};

export function parseTurnRequest(body: unknown): TurnRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError("Body must be a JSON object");
  }
  const parsed = turnRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new RequestError(`${where}${issue?.message ?? "Invalid turn request"}`);
  }
  return parsed.data;
}
