import { trimSlash } from "../config/env.js";
import { LlmError } from "../errors.js";
import { completeGhostTurn } from "../conversation/parseTurn.js";
import type { ChatMessage } from "../types.js";
import type { LlmProvider } from "./types.js";

export type OpenAiCompatibleOptions = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

/**
 * Any server that speaks POST /v1/chat/completions: LM Studio, llama.cpp, and others.
 * `baseUrl` includes the `/v1` prefix.
 */
export function createOpenAiCompatibleProvider(options: OpenAiCompatibleOptions): LlmProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `${trimSlash(options.baseUrl)}/chat/completions`;

  return {
    id: "openai",
    nextTurn(ghost, history) {
      return completeGhostTurn((messages) => complete(messages), ghost, history);
    },
  };

  async function complete(messages: ChatMessage[]): Promise<string> {
    const payload = {
      model: options.model,
      messages,
      temperature: 1,
      top_p: 0.95,
    };
    let response = await post({ ...payload, response_format: { type: "json_object" } });
    if (response.status === 400) {
      response = await post(payload);
    }
    const body = await response.text();
    if (!response.ok) throw new LlmError(`OpenAI-compatible ${response.status}: ${body.slice(0, 500)}`);
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      throw new LlmError("OpenAI-compatible server returned non-JSON");
    }
    const content = readChoiceContent(data);
    if (content === undefined) throw new LlmError("OpenAI-compatible response had no message content");
    return content;
  }

  function post(body: unknown): Promise<Response> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (options.apiKey?.trim()) headers.authorization = `Bearer ${options.apiKey.trim()}`;
    return fetchImpl(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  }
}

function readChoiceContent(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || !("choices" in data)) return undefined;
  const choices = data.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return undefined;
  const message = "message" in choices[0] ? choices[0].message : undefined;
  if (!message || typeof message !== "object" || !("content" in message)) return undefined;
  return typeof message.content === "string" ? message.content : undefined;
}
