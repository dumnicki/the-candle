import { localModel, trimSlash } from "../config/env.js";
import { createBackboardProvider } from "./backboard.js";
import { createMockProvider } from "./mock.js";
import { createOllamaProvider } from "./ollama.js";
import { createOpenAiCompatibleProvider } from "./openai.js";
import type { LlmProvider } from "./types.js";

const LAPTOP_DEFAULT = "gemma4:e4b";

export type ProviderDeps = {
  fetchImpl?: typeof fetch;
};

export function createLlmProvider(env: NodeJS.ProcessEnv, deps: ProviderDeps = {}): LlmProvider {
  const choice = (env.LLM_PROVIDER ?? "backboard").trim().toLowerCase();
  switch (choice) {
    case "backboard":
      return createBackboardProvider({
        apiKey: env.BACKBOARD_API_KEY ?? "",
        baseUrl: trimSlash(env.BACKBOARD_BASE_URL?.trim() || "https://app.backboard.io/api"),
        llmProvider: env.BACKBOARD_LLM_PROVIDER?.trim() || "openrouter",
        model: env.BACKBOARD_MODEL?.trim() || "google/gemma-4-26b-a4b-it",
        fetchImpl: deps.fetchImpl,
      });
    case "ollama":
      return createOllamaProvider({
        baseUrl: env.OLLAMA_URL?.trim() || "http://127.0.0.1:11434",
        model: localModel(env, env.OLLAMA_MODEL, LAPTOP_DEFAULT),
        fetchImpl: deps.fetchImpl,
      });
    case "openai":
    case "openai-compatible":
      return createOpenAiCompatibleProvider({
        baseUrl: env.OPENAI_BASE_URL?.trim() || "http://127.0.0.1:1234/v1",
        model: localModel(env, env.OPENAI_MODEL, LAPTOP_DEFAULT),
        apiKey: env.OPENAI_API_KEY,
        fetchImpl: deps.fetchImpl,
      });
    case "mock":
      return createMockProvider();
    default:
      throw new Error(
        `Unknown LLM_PROVIDER "${choice}". Use backboard, ollama, openai, or mock.`,
      );
  }
}

export type { LlmProvider } from "./types.js";
