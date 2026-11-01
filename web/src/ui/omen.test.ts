import assert from "node:assert/strict";
import test from "node:test";

import { OMENS, pickOmen } from "./omen.js";

test("the wait line is one of the shiver sentences", () => {
  assert.equal(pickOmen(() => 0), OMENS[0]);
  assert.equal(pickOmen(() => 0.99), OMENS[OMENS.length - 1]);
  assert.ok(OMENS.includes(pickOmen(() => 0.5)));
});
