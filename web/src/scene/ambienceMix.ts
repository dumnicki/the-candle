/** Milliseconds until the next one-shot, somewhere between 8 and 25 seconds. */
export function nextOneShotDelay(random: () => number = Math.random): number {
  return 8_000 + random() * 17_000;
}

/** A one-shot sits a little louder or quieter, and a little to one side. */
export function oneShotMix(random: () => number = Math.random): { gain: number; pan: number } {
  return {
    gain: 0.16 + random() * 0.34,
    pan: random() * 1.6 - 0.8,
  };
}
