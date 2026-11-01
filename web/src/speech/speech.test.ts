import assert from "node:assert/strict";
import test from "node:test";

import { createGhostLineSpeaker, createSilentGhostLineSpeaker, playGhostLine, type GhostLineSpeaker } from "./speech";

test("playGhostLine stops the previous line before speaking the next", async () => {
  const silent = createSilentGhostLineSpeaker();
  silent.stop();
  await silent.speak("Ah.", "eliza");

  const events: string[] = [];
  const speaker: GhostLineSpeaker = {
    async speak(ghostLine, ghostId) {
      events.push(`speak:${ghostId}:${ghostLine}`);
    },
    stop() {
      events.push("stop");
    },
  };
  await playGhostLine(speaker, "The wick still remembers.", "eliza");
  assert.deepEqual(events, ["stop", "speak:eliza:The wick still remembers."]);
});

test("a spoken line plays the mpeg from /api/tts and a quiet response does not", async () => {
  const played: number[][] = [];
  const requests: { url: string; body: { ghostId: string; text: string } }[] = [];
  let created = 0;
  const speaker = createGhostLineSpeaker({
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      if (requests.length === 1) {
        return new Response(new Uint8Array([9, 8, 7]), {
          status: 200,
          headers: { "content-type": "audio/mpeg" },
        });
      }
      return new Response(null, { status: 204 });
    },
    createPlayback(bytes) {
      created += 1;
      const copy = [...new Uint8Array(bytes)];
      return {
        async play() {
          played.push(copy);
        },
        stop() {
          played.push([-1]);
        },
      };
    },
  });

  await playGhostLine(speaker, "Ah.", "eliza");
  assert.equal(requests[0]?.url, "/api/tts");
  assert.deepEqual(requests[0]?.body, { ghostId: "eliza", text: "Ah." });
  assert.deepEqual(played, [[9, 8, 7]]);

  await playGhostLine(speaker, "The dark shifts.", "eliza");
  assert.equal(created, 1);
  assert.equal(played.length, 2);
  assert.deepEqual(played[1], [-1]);
});

test("a failed speech request and a cancelled line stay silent", async () => {
  const speaker = createGhostLineSpeaker({
    fetchImpl: async () => {
      throw new Error("offline");
    },
    createPlayback() {
      throw new Error("audio should not be created");
    },
  });
  await playGhostLine(speaker, "Ah.", "eliza");

  let played = false;
  let release: (response: Response) => void = () => undefined;
  const late = createGhostLineSpeaker({
    fetchImpl: (_input, init) =>
      new Promise((resolve, reject) => {
        release = resolve;
        init?.signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      }),
    createPlayback() {
      played = true;
      return {
        async play() {
          return;
        },
        stop() {
          return;
        },
      };
    },
  });
  const pending = late.speak("Wait.", "eliza");
  late.stop();
  release(new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "audio/mpeg" } }));
  await pending;
  assert.equal(played, false);
});
