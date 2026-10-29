import { trimSlash } from "../config/env.js";
import { LlmError } from "../errors.js";
import { completeGhostTurn } from "../conversation/parseTurn.js";
import type { ChatMessage } from "../types.js";
import type { LlmProvider } from "./types.js";

export type OllamaOptions = {
  baseUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
};

/** Gemma 4 sampling from the Ollama model card. Thinking stays off. */
const OLLAMA_OPTIONS = { temperature: 1, top_p: 0.95, top_k: 64 };

export function createOllamaProvider(options: OllamaOptions): LlmProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `${trimSlash(options.baseUrl)}/api/chat`;

  return {
    id: "ollama",
    nextTurn(ghost, history) {
      return completeGhostTurn((messages) => complete(messages), ghost, history);
    },
  };

  async function complete(messages: ChatMessage[]): Promise<string> {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        messages,
        format: "json",
        stream: false,
        options: OLLAMA_OPTIONS,
      }),
    });
    const body = await response.text();
    if (!response.ok) throw new LlmError(`Ollama ${response.status}: ${body.slice(0, 500)}`);
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      throw new LlmError("Ollama returned non-JSON");
    }
    const content =
      data &&
      typeof data === "object" &&
      "message" in data &&
      data.message &&
      typeof data.message === "object" &&
      "content" in data.message &&
      typeof data.message.content === "string"
        ? data.message.content
        : undefined;
    if (content === undefined) throw new LlmError("Ollama response had no message content");
    return content;
  }
}
