/** Shown once, at random, while the first voice is still on its way. */
export const OMENS = [
  "You feel shivers down your spine.",
  "A cold draft finds the back of your neck.",
  "The room seems to hold its breath.",
  "Something shifts in the dark.",
  "The silence presses in closer.",
  "You are no longer sure you are alone.",
];

export function pickOmen(random: () => number = Math.random): string {
  const index = Math.min(OMENS.length - 1, Math.floor(random() * OMENS.length));
  return OMENS[index] ?? OMENS[0];
}
