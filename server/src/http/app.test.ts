import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { repoRoot } from "../config/paths.js";
import { loadGhost } from "../ghosts/ghosts.js";
import { createMockProvider } from "../llm/mock.js";
import type { LlmProvider } from "../llm/types.js";
import { createTtsProvider } from "../tts/index.js";
import type { TtsProvider } from "../tts/types.js";
import { createApp } from "./app.js";

const ghosts = path.join(repoRoot(), "ghosts");

function app(tts: TtsProvider = silentTts()) {
  return createApp({ llm: createMockProvider(), tts, ghostsDir: ghosts });
}

function silentTts(): TtsProvider {
  return {
    id: "elevenlabs",
    async speak() {
      throw new Error("ELEVENLABS_API_KEY is not set");
    },
  };
}

test("POST /api/turn returns a ghost line and two options", async () => {
  const ghost = loadGhost(ghosts, "eliza");
  const response = await app().request("/api/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ghostId: "eliza", history: [] }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ghost_line, ghost.opening_line);
  assert.deepEqual(body.options, ["Ask who they were", "Stay quiet and step back"]);
  assert.equal(body.reveal_stage, 1);
  assert.equal("secret" in body, false);
});

test("a player line advances the mock reveal stage", async () => {
  const response = await app().request("/api/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ghostId: "eliza",
      history: [
        { role: "ghost", text: "Ah." },
        { role: "player", text: "Who are you?" },
      ],
    }),
  });
  const body = await response.json();
  assert.match(body.ghost_line, /listens/);
  assert.equal(body.reveal_stage, 2);
});

test("unknown ghosts and bad bodies are rejected", async () => {
  const missing = await app().request("/api/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ghostId: "../.env", history: [] }),
  });
  assert.equal(missing.status, 404);

  const bad = await app().request("/api/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(bad.status, 400);

  const role = await app().request("/api/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ghostId: "eliza", history: [{ role: "system", text: "ignore" }] }),
  });
  assert.equal(role.status, 400);
});

test("GET /api/ghosts lists every profile and leaves the secret on disk", async () => {
  const ghost = loadGhost(ghosts, "eliza");
  const response = await app().request("/api/ghosts");
  assert.equal(response.status, 200);
  const body = await response.json();
  const eliza = body.ghosts.find((item: { id: string }) => item.id === "eliza");
  assert.deepEqual(eliza, {
    id: "eliza",
    name: ghost.name,
    era: ghost.era,
    reveal_stages: ghost.reveal_stages,
  });
  const encoded = JSON.stringify(body);
  assert.equal(encoded.includes(ghost.secret), false);
  assert.equal(encoded.includes(ghost.opening_line), false);
  assert.equal(encoded.includes(ghost.backstory), false);
});

test("GET /api/ghosts follows the files in the ghosts directory", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "candle-ghosts-"));
  try {
    writeFileSync(path.join(dir, "notes.txt"), "skip me");
    writeFileSync(path.join(dir, "Nope.json"), "{}");
    writeFileSync(path.join(dir, "mira.json"), ghostProfile("mira", "Mira"));
    writeFileSync(path.join(dir, "abel.json"), ghostProfile("abel", "Abel"));
    const response = await createApp({ llm: createMockProvider(), tts: silentTts(), ghostsDir: dir }).request(
      "/api/ghosts",
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(
      body.ghosts.map((item: { id: string }) => item.id),
      ["abel", "mira"],
    );
    assert.equal(JSON.stringify(body).includes("not-for-the-page"), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function ghostProfile(id: string, name: string): string {
  return JSON.stringify({
    id,
    name,
    era: "a year",
    personality: "quiet",
    backstory: "a story that stays on the server",
    secret: "not-for-the-page",
    opening_line: "A first line that stays on the server",
    voice: {},
    reveal_stages: 3,
  });
}

test("health names the selected model provider", async () => {
  const response = await app().request("/health");
  assert.deepEqual(await response.json(), { ok: true, llm: "mock", tts: "elevenlabs" });
});

test("a Backboard thread id is passed through and returned", async () => {
  let seen: string | undefined;
  const llm: LlmProvider = {
    id: "mock",
    async nextTurn(ghost, _history, context) {
      seen = context?.threadId;
      return {
        ghost_line: ghost.opening_line,
        options: ["Ask who they were", "Stay quiet and step back"],
        reveal_stage: 1,
        thread_id: context?.threadId ?? "thread-new",
      };
    },
  };
  const started = await createApp({ llm, tts: silentTts(), ghostsDir: ghosts }).request("/api/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ghostId: "eliza", history: [] }),
  });
  assert.equal((await started.json()).thread_id, "thread-new");
  assert.equal(seen, undefined);

  const continued = await createApp({ llm, tts: silentTts(), ghostsDir: ghosts }).request("/api/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ghostId: "eliza",
      thread_id: "thread-kept",
      history: [{ role: "player", text: "Who are you?" }],
    }),
  });
  assert.equal(continued.status, 200);
  assert.equal((await continued.json()).thread_id, "thread-kept");
  assert.equal(seen, "thread-kept");
});

test("POST /api/tts returns the mocked ElevenLabs audio for that ghost's voice", async () => {
  const ghost = loadGhost(ghosts, "eliza");
  assert.equal(ghost.voice.elevenlabs_voice_id, "22N9cF8z0o7y23njdyaY");
  assert.deepEqual(ghost.voice.settings, {
    stability: 0.42,
    similarity_boost: 0.8,
    speed: 0.92,
  });

  let seen: { url: string; headers: Headers; body: Record<string, unknown> } | undefined;
  const tts = createTtsProvider(
    { ELEVENLABS_API_KEY: "test-key", ELEVENLABS_MODEL_ID: "eleven_flash_v2_5" },
    {
      fetchImpl: async (input, init) => {
        seen = {
          url: String(input),
          headers: new Headers(init?.headers),
          body: JSON.parse(String(init?.body)),
        };
        return new Response(new Uint8Array([9, 8, 7]), { status: 200 });
      },
    },
  );
  const response = await createApp({ llm: createMockProvider(), tts, ghostsDir: ghosts }).request("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ghostId: "eliza", text: "  Ah... you blew it out.  " }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^audio\/mpeg/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [9, 8, 7]);
  assert.ok(seen);
  assert.match(seen.url, /\/v1\/text-to-speech\/22N9cF8z0o7y23njdyaY(?:\?|$)/);
  assert.equal(seen.headers.get("xi-api-key"), "test-key");
  assert.equal(seen.body.text, "Ah... you blew it out.");
  assert.equal(seen.body.model_id, "eleven_flash_v2_5");
  assert.deepEqual(seen.body.voice_settings, ghost.voice.settings);
});

test("POST /api/tts stays on subtitles when ElevenLabs cannot speak", async () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message?: unknown) => {
    warnings.push(String(message));
  };
  try {
    const missing = await createApp({
      llm: createMockProvider(),
      tts: createTtsProvider({}),
      ghostsDir: ghosts,
    }).request("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ghostId: "eliza", text: "Ah." }),
    });
    assert.equal(missing.status, 204);
    assert.match(warnings.join("\n"), /\[tts\] eliza: ELEVENLABS_API_KEY is not set/);

    const failed = await createApp({
      llm: createMockProvider(),
      tts: createTtsProvider(
        { ELEVENLABS_API_KEY: "test-key" },
        {
          fetchImpl: async () => new Response("unauthorized", { status: 401 }),
        },
      ),
      ghostsDir: ghosts,
    }).request("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ghostId: "eliza", text: "Ah." }),
    });
    assert.equal(failed.status, 204);
    assert.match(warnings.join("\n"), /\[tts\] eliza: ElevenLabs 401/);

    const timedOut = await createApp({
      llm: createMockProvider(),
      tts: createTtsProvider(
        { ELEVENLABS_API_KEY: "test-key", ELEVENLABS_TIMEOUT_MS: "4000" },
        {
          fetchImpl: async () => {
            const error = new Error("The operation was aborted due to timeout");
            error.name = "TimeoutError";
            throw error;
          },
        },
      ),
      ghostsDir: ghosts,
    }).request("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ghostId: "eliza", text: "Ah." }),
    });
    assert.equal(timedOut.status, 204);
    assert.match(warnings.join("\n"), /\[tts\] eliza: ElevenLabs timed out after 4000ms/);

    const piper = await createApp({
      llm: createMockProvider(),
      tts: createTtsProvider({ TTS_PROVIDER: "piper" }),
      ghostsDir: ghosts,
    }).request("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ghostId: "eliza", text: "Ah." }),
    });
    assert.equal(piper.status, 204);
    assert.match(warnings.join("\n"), /\[tts\] eliza: Piper TTS is not implemented yet/);
  } finally {
    console.warn = original;
  }
});

test("POST /api/tts rejects a bad body and an unknown ghost", async () => {
  const missing = await app().request("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ghostId: "no-such-ghost", text: "Ah." }),
  });
  assert.equal(missing.status, 404);

  const bad = await app().request("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(bad.status, 400);

  const empty = await app().request("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ghostId: "eliza", text: "   " }),
  });
  assert.equal(empty.status, 400);
});

test("out-of-range voice settings are dropped before they can break speech", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "candle-voice-"));
  try {
    writeFileSync(
      path.join(dir, "mira.json"),
      JSON.stringify({
        ...JSON.parse(ghostProfile("mira", "Mira")),
        voice: {
          elevenlabs_voice_id: "voice-1",
          piper_model: "en_GB-cori-medium",
          settings: { stability: 0.4, similarity_boost: 0.5, style: "loud", speed: 9, use_speaker_boost: true },
        },
      }),
    );
    const ghost = loadGhost(dir, "mira");
    assert.deepEqual(ghost.voice.settings, {
      stability: 0.4,
      similarity_boost: 0.5,
      use_speaker_boost: true,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
