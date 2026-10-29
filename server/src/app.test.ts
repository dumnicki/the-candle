import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createApp } from "./app.js";
import { loadGhost } from "./ghosts.js";
import { createMockProvider } from "./llm/mock.js";
import { repoRoot } from "./paths.js";

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

test("health names the selected model provider", async () => {
  const response = await app().request("/health");
  assert.deepEqual(await response.json(), { ok: true, llm: "mock" });
});
