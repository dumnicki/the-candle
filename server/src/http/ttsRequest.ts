import { z } from "zod";

import { RequestError } from "../errors.js";

/** Matches the longest ghost line the model parser will accept, with a little room. */
const MAX_TEXT = 2000;

const ttsRequestSchema = z
  .object({
    ghostId: z.string("ghostId is required").trim().min(1, "ghostId is required"),
    text: z.string().trim().max(MAX_TEXT, "text is too long").optional(),
    opening: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.opening) return;
    if (!value.text) {
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: "text must be a non-empty string",
      });
    }
  });

export type TtsRequest = {
  ghostId: string;
  text?: string;
  /** Speak the ghost's opening line. The client does not have that text. */
  opening?: boolean;
};

export function parseTtsRequest(body: unknown): TtsRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError("Body must be a JSON object");
  }
  const parsed = ttsRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new RequestError(`${where}${issue?.message ?? "Invalid speech request"}`);
  }
  return parsed.data;
}
