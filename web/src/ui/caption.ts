/** Drop ElevenLabs audio tags so a subtitle reads as speech. */
export function captionText(line: string): string {
  const stripped = line
    .replace(/\s*\[[^[\]]{1,80}\]\s*/g, " ")
    .replace(/\s+([,.!?…;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || line.trim();
}

/** One step of the letter-by-letter fade. Spaces still take a step so the line breathes. */
export const LETTER_STEP_MS = 42;

export function captionLetters(text: string): { char: string; delayMs: number }[] {
  return [...text].map((char, index) => ({ char, delayMs: index * LETTER_STEP_MS }));
}
