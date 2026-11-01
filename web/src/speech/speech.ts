/**
 * Speaks one `ghost_line` with audio from this app's server.
 *
 * The room calls `playGhostLine` after the subtitle is on screen and does
 * not wait on it before showing reply buttons. `POST /api/tts` looks up
 * the ghost's voice. The ElevenLabs key stays on the server. A missing
 * key, a stub provider, or a failed request resolves quietly so the
 * subtitles still carry the line.
 *
 * Browsers block sound until the visitor has clicked or pressed. Blowing
 * the candle out (microphone permission, or holding the mouse) is that
 * gesture, so playback is allowed by the time a line arrives. `stop`
 * drops a line that is still downloading or playing.
 */
export interface GhostLineSpeaker {
  speak(ghostLine: string, ghostId: string): Promise<void>;
  stop(): void;
}

export type LinePlayback = {
  play(): Promise<void>;
  stop(): void;
};

export type GhostLineSpeakerOptions = {
  fetchImpl?: typeof fetch;
  createPlayback?: (bytes: ArrayBuffer, contentType: string) => LinePlayback;
  endpoint?: string;
};

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

/** Factory the room uses. Fetches `/api/tts` and plays the mpeg it returns. */
export function createGhostLineSpeaker(options: GhostLineSpeakerOptions = {}): GhostLineSpeaker {
  const fetchImpl = options.fetchImpl ?? fetch;
  const createPlayback = options.createPlayback ?? browserPlayback;
  const endpoint = options.endpoint ?? "/api/tts";
  let generation = 0;
  let controller: AbortController | null = null;
  let playback: LinePlayback | null = null;

  function halt(): void {
    controller?.abort();
    controller = null;
    const current = playback;
    playback = null;
    current?.stop();
  }

  return {
    stop() {
      generation += 1;
      halt();
    },
    async speak(ghostLine, ghostId) {
      const text = ghostLine.trim();
      const id = ghostId.trim();
      if (!text || !id) return;
      halt();
      const mine = ++generation;
      const next = new AbortController();
      controller = next;
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ghostId: id, text }),
          signal: next.signal,
        });
        if (mine !== generation) return;
        if (response.status === 204 || !response.ok) return;
        const type = response.headers.get("content-type") ?? "";
        if (!type.toLowerCase().includes("audio")) return;
        const bytes = await response.arrayBuffer();
        if (mine !== generation || bytes.byteLength === 0) return;
        const line = createPlayback(bytes, type);
        if (mine !== generation) {
          line.stop();
          return;
        }
        playback = line;
        await line.play();
      } catch (error) {
        if (mine !== generation || isAbort(error)) return;
      } finally {
        if (controller === next) controller = null;
      }
    },
  };
}

/** Stop any current line, then speak the new one. */
export async function playGhostLine(
  speaker: GhostLineSpeaker,
  ghostLine: string,
  ghostId: string,
): Promise<void> {
  speaker.stop();
  await speaker.speak(ghostLine, ghostId);
}

function browserPlayback(bytes: ArrayBuffer, contentType: string): LinePlayback {
  const mime = contentType.split(";")[0]?.trim() || "audio/mpeg";
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const audio = new Audio(url);
  let revoked = false;
  const revoke = () => {
    if (revoked) return;
    revoked = true;
    URL.revokeObjectURL(url);
  };
  audio.addEventListener("ended", revoke, { once: true });
  return {
    async play() {
      try {
        await audio.play();
      } catch (error) {
        revoke();
        throw error;
      }
    },
    stop() {
      audio.pause();
      audio.src = "";
      revoke();
    },
  };
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
