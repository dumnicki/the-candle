import assert from "node:assert/strict";
import test from "node:test";

import { createGhostLineSpeaker, playGhostLine, type GhostLineSpeaker } from "./speech";

test("the default speaker is silent and playGhostLine stops before speaking", async () => {
  const silent = createGhostLineSpeaker();
  silent.stop();
  await silent.speak("Ah.");

  const events: string[] = [];
  const speaker: GhostLineSpeaker = {
    async speak(ghostLine) {
      events.push(`speak:${ghostLine}`);
    },
    stop() {
      events.push("stop");
    },
  };
  await playGhostLine(speaker, "The wick still remembers.");
  assert.deepEqual(events, ["stop", "speak:The wick still remembers."]);
});
