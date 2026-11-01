import assert from "node:assert/strict";
import test from "node:test";

import { pickGhost, windFromCursor } from "./blow";

const flame = { x: 400, y: 300 };

test("wind from the left bends the flame away, to the right", () => {
  const wind = windFromCursor(flame, { x: 250, y: 300 }, true);
  assert.ok(wind.lean > 20);
  assert.ok(wind.shiftX > 0);
  assert.equal(wind.extinguish, false);
});

test("wind falls off sharply as the cursor moves away from the flame", () => {
  const near = windFromCursor(flame, { x: 250, y: 300 }, true);
  const far = windFromCursor(flame, { x: 80, y: 300 }, true);
  const beyond = windFromCursor(flame, { x: 400 - 700, y: 300 }, true);
  assert.ok(far.lean > 0);
  assert.ok(near.lean > far.lean * 2);
  assert.ok(near.closeness > far.closeness);
  assert.equal(beyond.lean, 0);
  assert.equal(beyond.shiftX, 0);
});

test("a close cursor while the button is held blows the flame out", () => {
  const wind = windFromCursor(flame, { x: 360, y: 280 }, true);
  assert.equal(wind.extinguish, true);
});

test("the flame stands still when the button is up", () => {
  const wind = windFromCursor(flame, { x: 360, y: 280 }, false);
  assert.equal(wind.lean, 0);
  assert.equal(wind.extinguish, false);
});

test("a random ghost is chosen from the catalog", () => {
  const ghosts = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(pickGhost(ghosts, () => 0)?.id, "a");
  assert.equal(pickGhost(ghosts, () => 0.99)?.id, "c");
  assert.equal(pickGhost([]), null);
});
