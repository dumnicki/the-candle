import assert from "node:assert/strict";
import test from "node:test";

import {
  catalogFailed,
  catalogSucceeded,
  createRoomState,
  markTurnLoading,
  requestChoice,
  requestOpening,
  restartGhost,
  returnToChooser,
  turnFailed,
  turnSucceeded,
} from "./session";
import type { GhostChoice, TurnResult } from "./types";

const eliza: GhostChoice = {
  id: "eliza",
  name: "Eliza Marrow",
  era: "died 1891",
  reveal_stages: 4,
};

const mira: GhostChoice = {
  id: "mira",
  name: "Mira",
  era: "a year",
  reveal_stages: 3,
};

function withGhosts() {
  return catalogSucceeded(createRoomState(), [mira, eliza]);
}

function opening(options: string[], threadId?: string): TurnResult {
  return {
    ghost_line: "Ah.",
    options,
    reveal_stage: 1,
    ...(threadId ? { thread_id: threadId } : {}),
  };
}

test("choosing a ghost starts a visit with an empty history and no thread", () => {
  const next = requestOpening(withGhosts(), "eliza");
  assert.ok(next);
  assert.equal(next.state.phase, "loading");
  assert.equal(next.state.ghost?.id, "eliza");
  assert.equal(next.state.threadId, undefined);
  assert.deepEqual(next.request, { ghostId: "eliza", history: [] });
  assert.equal("thread_id" in next.request, false);
  assert.equal(requestOpening(withGhosts(), "missing"), null);
});

test("a reply appends the ghost line and the chosen option, for any option count", () => {
  const opened = requestOpening(withGhosts(), "eliza");
  assert.ok(opened);
  const line = turnSucceeded(opened.state, opening(["one", "two", "three"], "thread-1"));
  assert.deepEqual(line.options, ["one", "two", "three"]);
  assert.equal(line.threadId, "thread-1");

  assert.equal(requestChoice(line, 3), null);
  assert.equal(requestChoice(line, -1), null);
  const chosen = requestChoice(line, 2);
  assert.ok(chosen);
  assert.deepEqual(chosen.request.history, [
    { role: "ghost", text: "Ah." },
    { role: "player", text: "three" },
  ]);
  assert.equal(chosen.request.thread_id, "thread-1");
  assert.deepEqual(chosen.state.options, []);
  assert.equal(chosen.state.ghostLine, "Ah.");
});

test("a failed turn keeps the request for retry and does not append twice", () => {
  const opened = requestOpening(withGhosts(), "eliza");
  assert.ok(opened);
  const line = turnSucceeded(opened.state, opening(["Ask", "Wait"]));
  const chosen = requestChoice(line, 0);
  assert.ok(chosen);
  const failed = turnFailed(chosen.state, "The wick snapped.");
  assert.equal(failed.phase, "error");
  assert.equal(failed.error, "The wick snapped.");
  assert.equal(failed.history.length, 2);
  assert.deepEqual(failed.pending, { kind: "turn", request: chosen.request });

  const retry = markTurnLoading(failed);
  assert.equal(retry.phase, "loading");
  assert.equal(retry.history.length, 2);
  assert.equal(retry.pending?.kind, "turn");
});

test("a later turn keeps the thread when the response omits it", () => {
  const opened = requestOpening(withGhosts(), "eliza");
  assert.ok(opened);
  const line = turnSucceeded(opened.state, opening(["Ask"], "thread-kept"));
  const chosen = requestChoice(line, 0);
  assert.ok(chosen);
  const continued = turnSucceeded(chosen.state, {
    ghost_line: "The room stays cold.",
    options: ["Only one"],
    reveal_stage: 2,
  });
  assert.equal(continued.threadId, "thread-kept");
  assert.deepEqual(continued.options, ["Only one"]);
  assert.equal(continued.revealStage, 2);
});

test("starting again and choosing another ghost both drop the thread", () => {
  const opened = requestOpening(withGhosts(), "eliza");
  assert.ok(opened);
  const line = turnSucceeded(opened.state, opening(["Ask", "Wait"], "thread-1"));
  const chosen = requestChoice(line, 1);
  assert.ok(chosen);

  const again = restartGhost(chosen.state);
  assert.ok(again);
  assert.deepEqual(again.request, { ghostId: "eliza", history: [] });
  assert.equal(again.state.threadId, undefined);
  assert.equal(again.state.ghostLine, null);

  const chooser = returnToChooser(chosen.state);
  assert.equal(chooser.phase, "choose");
  assert.equal(chooser.ghost, null);
  assert.equal(chooser.threadId, undefined);
  assert.deepEqual(
    chooser.ghosts.map((ghost) => ghost.id),
    ["mira", "eliza"],
  );
});

test("a catalog failure can be retried without inventing a ghost", () => {
  const failed = catalogFailed(createRoomState(), "The door is shut.");
  assert.equal(failed.phase, "error");
  assert.equal(failed.pending?.kind, "catalog");
  assert.equal(failed.ghost, null);
  assert.equal(restartGhost(failed), null);
});
