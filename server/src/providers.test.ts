import assert from "node:assert/strict";
import test from "node:test";

import { LlmError } from "./errors.js";
import { createLlmProvider } from "./llm/index.js";
import { createTtsProvider } from "./tts/index.js";
import type { Ghost } from "./types.js";

const ghost: Ghost = {
  id: "eliza",
  name: "Eliza Marrow",
  era: "died 1891",
  personality: "polite",
  backstory: "Housekeeper.",
  secret: "hidden",
  opening_line: "Ah.",
  voice: { elevenlabs_voice_id: "voice-1", piper_model: "en_GB-test" },
  reveal_stages: 4,
};

const valid = JSON.stringify({
  ghost_line: "The dark is familiar.",
  options: ["Ask her name", "Step back"],
  reveal_stage: 1,
});

test("the default provider is Backboard and it asks OpenRouter for Gemma 4", async () => {
  const seen: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const llm = createLlmProvider(
    { BACKBOARD_API_KEY: "test-key" },
    {
      fetchImpl: async (input, init) => {
        seen.push({
          url: String(input),
          headers: new Headers(init?.headers),
          body: JSON.parse(String(init?.body)),
        });
        return Response.json({ content: valid, status: "COMPLETED" });
      },
    },
  );
  assert.equal(llm.id, "backboard");
  const turn = await llm.nextTurn(ghost, [{ role: "player", text: "Who are you?" }]);
  assert.equal(turn.options[1], "Step back");
  assert.equal(seen.length, 1);
  const call = seen[0];
  assert.ok(call);
  assert.equal(call.url, "https://app.backboard.io/api/threads/messages");
  assert.equal(call.headers.get("X-API-Key"), "test-key");
  assert.equal(call.body.llm_provider, "openrouter");
  assert.equal(call.body.model_name, "google/gemma-4-26b-a4b-it");
  assert.equal(call.body.json_output, true);
  assert.equal(call.body.memory, "off");
  assert.match(String(call.body.system_prompt), /Eliza Marrow/);
  assert.match(String(call.body.content), /Who are you\?/);
});

test("Backboard without a key fails before the network", async () => {
  const llm = createLlmProvider({ LLM_PROVIDER: "backboard" }, { fetchImpl: unreachable });
  await assert.rejects(() => llm.nextTurn(ghost, []), /BACKBOARD_API_KEY/);
});

test("Ollama sends Gemma 4 E4B with JSON format", async () => {
  let body: Record<string, unknown> | undefined;
  const llm = createLlmProvider(
    { LLM_PROVIDER: "ollama" },
    {
      fetchImpl: async (_input, init) => {
        body = JSON.parse(String(init?.body));
        return Response.json({ message: { role: "assistant", content: valid } });
      },
    },
  );
  await llm.nextTurn(ghost, []);
  assert.equal(body?.model, "gemma4:e4b");
  assert.equal(body?.format, "json");
  assert.equal(body?.stream, false);
});

test("an OpenAI-compatible server retries without response_format after a 400", async () => {
  const bodies: Record<string, unknown>[] = [];
  let sawAuthorization = false;
  const llm = createLlmProvider(
    { LLM_PROVIDER: "openai", OPENAI_BASE_URL: "http://127.0.0.1:8080/v1", OPENAI_MODEL: "gemma4" },
    {
      fetchImpl: async (input, init) => {
        assert.equal(String(input), "http://127.0.0.1:8080/v1/chat/completions");
        sawAuthorization = sawAuthorization || new Headers(init?.headers).has("authorization");
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        bodies.push(body);
        if ("response_format" in body) return new Response("unsupported", { status: 400 });
        return Response.json({ choices: [{ message: { content: valid } }] });
      },
    },
  );
  const turn = await llm.nextTurn(ghost, []);
  assert.equal(turn.ghost_line, "The dark is familiar.");
  assert.equal(bodies.length, 2);
  assert.equal(bodies[1]?.model, "gemma4");
  assert.equal("response_format" in (bodies[1] ?? {}), false);
  assert.equal(sawAuthorization, false);
});

test("an unknown provider name is rejected", () => {
  assert.throws(() => createLlmProvider({ LLM_PROVIDER: "gemini" }), /Unknown LLM_PROVIDER/);
});

test("ElevenLabs is the default voice and Piper is a stub", async () => {
  const eleven = createTtsProvider({ ELEVENLABS_API_KEY: "key" }, { fetchImpl: unreachable });
  assert.equal(eleven.id, "elevenlabs");
  await assert.rejects(() => eleven.speak("hello", { elevenlabs_voice_id: "TBD" }), /not set/);

  let called = "";
  const live = createTtsProvider(
    { ELEVENLABS_API_KEY: "key", ELEVENLABS_MODEL_ID: "eleven_multilingual_v2" },
    {
      fetchImpl: async (input, init) => {
        called = String(input);
        assert.equal(new Headers(init?.headers).get("xi-api-key"), "key");
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      },
    },
  );
  const audio = await live.speak("hello", { elevenlabs_voice_id: "voice-1" });
  assert.match(called, /\/v1\/text-to-speech\/voice-1$/);
  assert.equal(audio.byteLength, 3);

  const piper = createTtsProvider({ TTS_PROVIDER: "piper" });
  await assert.rejects(() => piper.speak("hello", {}), /not implemented/);
});

function unreachable(): Promise<Response> {
  return Promise.reject(new LlmError("network should not be called"));
}
