import assert from "node:assert/strict";
import test from "node:test";

import { createBlowTrack, levelFromSamples, trackBlow } from "./mic";

test("silence is not a blow, and a loud waveform is", () => {
  assert.equal(levelFromSamples(new Float32Array(64)), 0);
  const loud = new Float32Array(64).fill(0.2);
  assert.ok(levelFromSamples(loud) > 0.9);
});

test("a soft blow bends the flame and a held hard blow puts it out", () => {
  const track = createBlowTrack();
  assert.deepEqual(trackBlow(track, 0.1, 0), { blowing: false, extinguish: false });
  assert.deepEqual(trackBlow(track, 0.4, 100), { blowing: true, extinguish: false });
  assert.deepEqual(trackBlow(track, 0.9, 200), { blowing: true, extinguish: false });
  assert.deepEqual(trackBlow(track, 0.9, 500), { blowing: true, extinguish: true });
});

test("letting up resets the hard breath", () => {
  const track = createBlowTrack();
  trackBlow(track, 0.9, 0);
  trackBlow(track, 0.05, 100);
  assert.equal(trackBlow(track, 0.9, 200).extinguish, false);
});
