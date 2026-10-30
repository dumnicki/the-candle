/**
 * Speaks one `ghost_line`. The page does not talk yet.
 *
 * `createGhostLineSpeaker` is the plug-in point. It returns a silent
 * speaker. A later ElevenLabs implementation should play audio fetched
 * from this app's server (the API key stays off the page) and replace
 * that return value. The room calls `playGhostLine` after the subtitles
 * are on screen and does not wait on it before showing reply buttons.
 */
export interface GhostLineSpeaker {
  speak(ghostLine: string): Promise<void>;
  stop(): void;
}

export function createSilentGhostLineSpeaker(): GhostLineSpeaker {
  return {
    async speak() {
      return;
    },
    stop() {
      return;
    },
  };
}

/** Factory the room uses. Swap the body when ElevenLabs is ready. */
export function createGhostLineSpeaker(): GhostLineSpeaker {
  return createSilentGhostLineSpeaker();
}

/** Stop any current line, then speak the new one. */
export async function playGhostLine(speaker: GhostLineSpeaker, ghostLine: string): Promise<void> {
  speaker.stop();
  await speaker.speak(ghostLine);
}
