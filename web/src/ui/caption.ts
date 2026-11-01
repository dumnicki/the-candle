/** Drop ElevenLabs audio tags so a subtitle reads as speech. */
export function captionText(line: string): string {
  const stripped = line
    .replace(/\s*\[[^[\]]{1,80}\]\s*/g, " ")
    .replace(/\s+([,.!?…;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || line.trim();
}
