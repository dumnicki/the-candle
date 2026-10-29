import { completeGhostTurn } from "../conversation/parseTurn.js";
import { LlmError } from "../errors.js";
import type { ChatMessage } from "../types.js";
import type { LlmProvider } from "./types.js";

export type BackboardOptions = {
  apiKey: string;
  baseUrl: string;
  llmProvider: string;
  model: string;
  fetchImpl?: typeof fetch;
};

/**
 * One Backboard message per turn. Pass `thread_id` to continue the visit;
 * omit it and Backboard creates the thread. The reply's `thread_id` goes
 * back to the caller. Memory stays off: the ghost's secret is a story, not
 * a user fact to save. Local providers still receive the full chat array.
 */
export function createBackboardProvider(options: BackboardOptions): LlmProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `${options.baseUrl.replace(/\/+$/, "")}/threads/messages`;

  return {
    id: "backboard",
    async nextTurn(ghost, history, context) {
      let threadId = context?.threadId;

      async function complete(messages: ChatMessage[]): Promise<string> {
        if (!options.apiKey.trim()) {
          throw new LlmError("BACKBOARD_API_KEY is not set");
        }
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "X-API-Key": options.apiKey,
          },
          body: JSON.stringify({
            content: latestUserContent(messages),
            system_prompt: systemPrompt(messages),
            ...(threadId ? { thread_id: threadId } : {}),
            llm_provider: options.llmProvider,
            model_name: options.model,
            json_output: true,
            memory: "off",
            stream: false,
          }),
        });
        const body = await response.text();
        if (!response.ok) {
          throw new LlmError(`Backboard ${response.status}: ${body.slice(0, 500)}`);
        }
        let data: unknown;
        try {
          data = JSON.parse(body);
        } catch {
          throw new LlmError("Backboard returned non-JSON");
        }
        if (!data || typeof data !== "object") throw new LlmError("Backboard returned an empty body");
        const record = data as Record<string, unknown>;
        if (typeof record.thread_id === "string" && record.thread_id.trim()) {
          threadId = record.thread_id.trim();
        }
        if (record.status === "FAILED") {
          const detail = typeof record.content === "string" ? record.content : "Backboard run failed";
          throw new LlmError(detail);
        }
        if (typeof record.content === "string") return record.content;
        if (record.content && typeof record.content === "object") return JSON.stringify(record.content);
        throw new LlmError("Backboard response had no content");
      }

      const turn = await completeGhostTurn((messages) => complete(messages), ghost, history);
      return threadId ? { ...turn, thread_id: threadId } : turn;
    },
  };
}

function systemPrompt(messages: ChatMessage[]): string {
  return messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
}

function latestUserContent(messages: ChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") return message.content;
  }
  throw new LlmError("Backboard turn had no visitor line");
}
