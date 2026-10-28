import { LlmError } from "../errors.js";
import { completeGhostTurn } from "../parseTurn.js";
import { flattenForBackboard } from "../prompt.js";
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
 * One stateless call per turn. The browser owns history, and the same history
 * has to work on Ollama, so we do not rely on Backboard's stored thread.
 * Memory stays off: the ghost's secret is a story, not a user fact to save.
 */
export function createBackboardProvider(options: BackboardOptions): LlmProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `${options.baseUrl.replace(/\/+$/, "")}/threads/messages`;

  return {
    id: "backboard",
    nextTurn(ghost, history) {
      return completeGhostTurn((messages) => complete(messages), ghost, history);
    },
  };

  async function complete(messages: ChatMessage[]): Promise<string> {
    if (!options.apiKey.trim()) {
      throw new LlmError("BACKBOARD_API_KEY is not set");
    }
    const { systemPrompt, content } = flattenForBackboard(messages);
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-API-Key": options.apiKey,
      },
      body: JSON.stringify({
        content,
        system_prompt: systemPrompt,
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
    if (record.status === "FAILED") {
      const detail = typeof record.content === "string" ? record.content : "Backboard run failed";
      throw new LlmError(detail);
    }
    if (typeof record.content === "string") return record.content;
    if (record.content && typeof record.content === "object") return JSON.stringify(record.content);
    throw new LlmError("Backboard response had no content");
  }
}
