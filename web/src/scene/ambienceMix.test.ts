import assert from "node:assert/strict";
import test from "node:test";

import { nextOneShotDelay, oneShotMix } from "./ambienceMix";

test("one-shots wait between 8 and 25 seconds", () => {
  assert.equal(nextOneShotDelay(() => 0), 8_000);
  assert.equal(nextOneShotDelay(() => 1), 25_000);
  const mid = nextOneShotDelay(() => 0.5);
  assert.ok(mid > 8_000 && mid < 25_000);
});

test("one-shots vary in loudness and sit off center", () => {
  const quietLeft = oneShotMix(() => 0);
  const loudRight = oneShotMix(() => 1);
  assert.equal(quietLeft.gain, 0.16);
  assert.equal(quietLeft.pan, -0.8);
  assert.equal(loudRight.gain, 0.5);
  assert.equal(loudRight.pan, 0.8);
});
