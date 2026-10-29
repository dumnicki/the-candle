import assert from "node:assert/strict";
import test from "node:test";

import { historyFromArgs, parseCliArgs } from "./cli.js";

test("the CLI defaults to Eliza and collects player lines", () => {
  const args = parseCliArgs(["--player", "Who are you?", "--say", "I'm sorry."]);
  assert.equal(args.ghostId, "eliza");
  assert.deepEqual(historyFromArgs(args), [
    { role: "player", text: "Who are you?" },
    { role: "player", text: "I'm sorry." },
  ]);
});

test("history JSON and player lines cannot be mixed", () => {
  const args = parseCliArgs(["--history", '[{"role":"player","text":"Hello"}]']);
  assert.deepEqual(historyFromArgs(args), [{ role: "player", text: "Hello" }]);
  assert.throws(() => parseCliArgs(["--history", "[]", "--player", "Hi"]), /not both/);
});
