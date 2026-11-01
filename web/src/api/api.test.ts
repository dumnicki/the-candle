import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, createApiClient, parseTurnResponse } from "./api";

test("a turn response may carry any number of options", () => {
  assert.deepEqual(parseTurnResponse({ ghost_line: "Ah.", options: ["Only"], reveal_stage: 0 }).options, ["Only"]);
  const many = parseTurnResponse({
    ghost_line: "  Listen.  ",
    options: [" one ", "two", "three", "four"],
    reveal_stage: 2,
    thread_id: " thread-9 ",
  });
  assert.equal(many.ghost_line, "Listen.");
  assert.deepEqual(many.options, ["one", "two", "three", "four"]);
  assert.equal(many.thread_id, "thread-9");
  assert.deepEqual(parseTurnResponse({ ghost_line: "Ah.", options: [], reveal_stage: 1 }).options, []);
});

test("a turn response rejects a fixed pair object and other bad shapes", () => {
  assert.throws(
    () => parseTurnResponse({ ghost_line: "Ah.", options: { a: "Look", b: "Leave" }, reveal_stage: 1 }),
    ApiError,
  );
  assert.throws(() => parseTurnResponse({ ghost_line: "Ah.", options: ["ok", 2], reveal_stage: 1 }), ApiError);
  assert.throws(() => parseTurnResponse({ ghost_line: "  ", options: ["ok"], reveal_stage: 1 }), ApiError);
  assert.throws(() => parseTurnResponse({ ghost_line: "Ah.", options: ["ok"], reveal_stage: 1.5 }), ApiError);
  assert.throws(
    () => parseTurnResponse({ ghost_line: "Ah.", options: ["ok"], reveal_stage: 1, thread_id: 4 }),
    ApiError,
  );
});

test("the client posts history and thread id, and reads a ghost list", async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    seen.push({ url: String(input), init });
    if (String(input) === "/api/ghosts") {
      return Response.json({
        ghosts: [{ id: "eliza", name: "Eliza Marrow", era: "died 1891", reveal_stages: 4, secret: "nope" }],
      });
    }
    return Response.json({
      ghost_line: "The room stays cold.",
      options: ["Ask", "Step back", "Wait"],
      reveal_stage: 2,
      thread_id: "thread-kept",
    });
  };

  const api = createApiClient(fetchImpl);
  const ghosts = await api.listGhosts();
  assert.deepEqual(ghosts, [{ id: "eliza", name: "Eliza Marrow", era: "died 1891", reveal_stages: 4 }]);
  assert.equal("secret" in ghosts[0]!, false);

  const turn = await api.sendTurn({
    ghostId: "eliza",
    history: [
      { role: "ghost", text: "Ah." },
      { role: "player", text: "Who are you?" },
    ],
    thread_id: "thread-kept",
  });
  assert.deepEqual(turn.options, ["Ask", "Step back", "Wait"]);
  const post = seen[1];
  assert.ok(post);
  assert.equal(post.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(post.init?.body)), {
    ghostId: "eliza",
    history: [
      { role: "ghost", text: "Ah." },
      { role: "player", text: "Who are you?" },
    ],
    thread_id: "thread-kept",
  });
});

test("API errors surface the server message, and a dead API says to start it", async () => {
  const failing: typeof fetch = async () => Response.json({ error: "Unknown ghost \"eliza\"" }, { status: 404 });
  await assert.rejects(() => createApiClient(failing).listGhosts(), /Unknown ghost/);

  const down: typeof fetch = async () => {
    throw new Error("connect ECONNREFUSED");
  };
  await assert.rejects(() => createApiClient(down).sendTurn({ ghostId: "eliza", history: [] }), /npm run dev/);
});
