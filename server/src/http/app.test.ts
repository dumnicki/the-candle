import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { repoRoot } from "../config/paths.js";
import { loadGhost } from "../ghosts/ghosts.js";
import { createMockProvider } from "../llm/mock.js";
import type { LlmProvider } from "../llm/types.js";
import { createApp } from "./app.js";

const ghosts = path.join(repoRoot(), "ghosts");

function app() {
  return createApp({ llm: createMockProvider(), ghostsDir: ghosts });
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
    const response = await createApp({ llm: createMockProvider(), ghostsDir: dir }).request("/api/ghosts");
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
  assert.deepEqual(await response.json(), { ok: true, llm: "mock" });
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
  const started = await createApp({ llm, ghostsDir: ghosts }).request("/api/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ghostId: "eliza", history: [] }),
  });
  assert.equal((await started.json()).thread_id, "thread-new");
  assert.equal(seen, undefined);

  const continued = await createApp({ llm, ghostsDir: ghosts }).request("/api/turn", {
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
