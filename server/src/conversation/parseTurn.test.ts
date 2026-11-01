import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { repoRoot } from "../config/paths.js";
import { loadGhost } from "../ghosts/ghosts.js";
import type { Ghost } from "../types.js";
import { completeGhostTurn, parseGhostTurn } from "./parseTurn.js";
import { buildMessages } from "./prompt.js";

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
  const tagged = parseGhostTurn(
    JSON.stringify({
      ghost_line: "[whispers] Stay.",
      options: ["[curious] Who are you?", "Leave"],
      reveal_stage: 0,
    }),
    ghost,
  );
  assert.equal(tagged?.ghost_line, "[whispers] Stay.");
  assert.equal(tagged?.options[0], "Who are you?");
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

test("a bound ghost is named in the prompt, and the other secret stays out", () => {
  const dir = path.join(repoRoot(), "ghosts");
  const thomas = loadGhost(dir, "thomas");
  const eliza = loadGhost(dir, "eliza");
  const [system] = buildMessages(thomas, []);
  assert.ok(system);
  assert.match(system.content, /Eliza Marrow is your mother/);
  assert.match(system.content, /\[whispers\]/);
  assert.equal(system.content.includes(eliza.secret), false);
  assert.match(system.content, /Keep its meaning and its audio tags/);
});

test("PLAN.md and README.md do not contain a committed ghost secret", () => {
  const dir = path.join(repoRoot(), "ghosts");
  const root = repoRoot();
  const docs = ["PLAN.md", "README.md"].map((name) => readFileSync(path.join(root, name), "utf8"));
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const loaded = loadGhost(dir, name.slice(0, -".json".length));
    for (const text of docs) {
      assert.equal(text.includes(loaded.secret), false, `${name} secret leaked`);
    }
  }
});
