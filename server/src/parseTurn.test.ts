import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadGhost } from "./ghosts.js";
import { completeGhostTurn, parseGhostTurn } from "./parseTurn.js";
import { buildMessages } from "./prompt.js";
import { repoRoot } from "./paths.js";
import type { Ghost } from "./types.js";

const ghost: Ghost = {
  id: "eliza",
  name: "Eliza Marrow",
  era: "died 1891",
  personality: "polite",
  backstory: "Housekeeper.",
  secret: "the hidden fact",
  opening_line: "Ah.",
  voice: {},
  reveal_stages: 4,
};

test("parseGhostTurn accepts a raw object, a fence, and a thought channel", () => {
  const raw = JSON.stringify({
    ghost_line: "The wick still remembers.",
    options: ["Who are you?", "I should go."],
    reveal_stage: 1,
  });
  assert.deepEqual(parseGhostTurn(raw, ghost)?.options[0], "Who are you?");
  assert.equal(parseGhostTurn("```json\n" + raw + "\n```", ghost)?.reveal_stage, 1);
  const thought = `<|channel>thought\nsecret planning\n<channel|>${raw}`;
  assert.equal(parseGhostTurn(thought, ghost)?.ghost_line, "The wick still remembers.");
  assert.equal(parseGhostTurn('{"options":{"a":"Look","b":"Leave"},"ghost_line":"Well.","reveal_stage":0}', ghost)?.options[1], "Leave");
});

test("parseGhostTurn rejects a stage past the ghost's last reveal", () => {
  const raw = JSON.stringify({
    ghost_line: "Too soon.",
    options: ["a", "b"],
    reveal_stage: 9,
  });
  assert.equal(parseGhostTurn(raw, ghost), null);
  assert.equal(parseGhostTurn("not json", ghost), null);
});

test("completeGhostTurn retries once when the first reply is not JSON", async () => {
  const calls: string[] = [];
  const turn = await completeGhostTurn(async (messages) => {
    calls.push(messages.at(-1)?.content ?? "");
    if (calls.length === 1) return "I am a ghost, not a document.";
    return JSON.stringify({
      ghost_line: "The house kept the hour.",
      options: ["Ask about the fire", "Say nothing"],
      reveal_stage: 1,
    });
  }, ghost, []);
  assert.equal(calls.length, 2);
  assert.equal(turn.ghost_line, "The house kept the hour.");
  assert.equal(turn.options.length, 2);
});

test("the system prompt carries the secret and does not enable thinking", () => {
  const [system] = buildMessages(ghost, []);
  assert.ok(system);
  assert.match(system.content, /the hidden fact/);
  assert.equal(system.content.startsWith("<|think|>"), false);
});

test("PLAN.md and README.md do not contain the committed ghost secret", () => {
  const loaded = loadGhost(path.join(repoRoot(), "ghosts"), "eliza");
  const root = repoRoot();
  for (const name of ["PLAN.md", "README.md"]) {
    const text = readFileSync(path.join(root, name), "utf8");
    assert.equal(text.includes(loaded.secret), false, `${name} contains the secret`);
  }
});
