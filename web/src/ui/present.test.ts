import assert from "node:assert/strict";
import test from "node:test";

import { captionLetters, captionText } from "./caption.js";
import { presentRoom, revealLabel } from "./present";
import {
  catalogFailed,
  catalogSucceeded,
  createRoomState,
  requestChoice,
  requestOpening,
  turnFailed,
  turnSucceeded,
} from "../session/session.js";
import type { GhostChoice } from "../types.js";

const eliza: GhostChoice = {
  id: "eliza",
  name: "Eliza Marrow",
  era: "died 1891",
  reveal_stages: 4,
};

function optionTexts(state: Parameters<typeof presentRoom>[0]): string[] {
  return presentRoom(state).choices.flatMap((button) => (button.kind === "option" ? [button.text] : []));
}

test("reveal stage is labeled against the ghost's last stage", () => {
  assert.equal(revealLabel(null, 4), null);
  assert.equal(revealLabel(2, 4), "Reveal 2 of 4");
  assert.equal(revealLabel(1, null), "Reveal 1");
});

test("the picker offers every ghost the catalog returned", () => {
  const state = catalogSucceeded(createRoomState(), [
    eliza,
    { id: "mira", name: "Mira", era: "a year", reveal_stages: 2 },
  ]);
  const presentation = presentRoom(state);
  assert.equal(presentation.title, "Who will you speak with?");
  assert.deepEqual(
    presentation.choices.map((button) => (button.kind === "ghost" ? button.id : "")),
    ["eliza", "mira"],
  );
  assert.deepEqual(presentation.actions, []);
});

test("reply buttons follow the option list, including one option and none", () => {
  const opened = requestOpening(catalogSucceeded(createRoomState(), [eliza]), "eliza");
  assert.ok(opened);
  const three = turnSucceeded(opened.state, {
    ghost_line: "Ah.",
    options: ["Look", "Listen", "Leave"],
    reveal_stage: 1,
  });
  const shown = presentRoom(three);
  assert.equal(shown.subtitle, "Ah.");
  const whispered = turnSucceeded(opened.state, {
    ghost_line: "[softly] Ah... [sighs] you blew it out.",
    options: ["Who are you?", "Step back"],
    reveal_stage: 0,
  });
  assert.equal(presentRoom(whispered).subtitle, "Ah... you blew it out.");
  assert.equal(captionText("[tired] [softly] Mother? [exhales] The candle is out."), "Mother? The candle is out.");
  assert.equal(shown.reveal, "Reveal 1 of 4");
  assert.deepEqual(optionTexts(three), ["Look", "Listen", "Leave"]);
  assert.deepEqual(
    shown.actions.map((button) => button.kind),
    ["restart", "change"],
  );

  const one = turnSucceeded(three, {
    ghost_line: "Only this.",
    options: ["Stay"],
    reveal_stage: 2,
  });
  assert.deepEqual(optionTexts(one), ["Stay"]);

  const none = turnSucceeded(three, {
    ghost_line: "Nothing more.",
    options: [],
    reveal_stage: 4,
  });
  const silent = presentRoom(none);
  assert.deepEqual(silent.choices, []);
  assert.match(silent.notice ?? "", /nothing more/i);
});

test("errors offer retry, and a failed first line does not offer a second restart", () => {
  const catalog = presentRoom(catalogFailed(createRoomState(), "The door is shut."));
  assert.equal(catalog.noticeKind, "error");
  assert.deepEqual(
    catalog.actions.map((button) => button.kind),
    ["retry"],
  );

  const opened = requestOpening(catalogSucceeded(createRoomState(), [eliza]), "eliza");
  assert.ok(opened);
  const first = presentRoom(turnFailed(opened.state, "no answer"));
  assert.deepEqual(
    first.actions.map((button) => button.kind),
    ["retry", "change"],
  );

  const line = turnSucceeded(opened.state, {
    ghost_line: "Ah.",
    options: ["Ask", "Wait"],
    reveal_stage: 1,
  });
  const chosen = requestChoice(line, 1);
  assert.ok(chosen);
  const later = presentRoom(turnFailed(chosen.state, "The wick snapped."));
  assert.equal(later.subtitle, "Ah.");
  assert.deepEqual(
    later.actions.map((button) => button.kind),
    ["retry", "restart", "change"],
  );
});

test("a subtitle is split into letters that fade in order", () => {
  assert.deepEqual(captionLetters("Ah."), [
    { char: "A", delayMs: 0 },
    { char: "h", delayMs: 42 },
    { char: ".", delayMs: 84 },
  ]);
  assert.equal(captionText("[whispers] Ah.").length > 0, true);
});
