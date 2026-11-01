/**
 * Speaks one ghost line with audio from this app's server.
 *
 * The opening line is spoken with `speakOpening` at the moment the candle
 * goes out. The room does not know that text; the server does. Later lines
 * use `speak` as soon as the turn returns. The promise resolves when
 * playback has started, or quietly when there is no audio. The room holds
 * the subtitle until then.
 *
 * `POST /api/tts` looks up the ghost's voice. The ElevenLabs key stays on
 * the server. Browsers block sound until the visitor has clicked or pressed.
 * Blowing the candle out is that gesture. `stop` drops a line that is still
 * downloading or playing.
 */
export interface GhostLineSpeaker {
  speak(ghostLine: string, ghostId: string): Promise<void>;
  speakOpening(ghostId: string): Promise<void>;
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
    async speakOpening() {
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

  async function request(body: { ghostId: string; text?: string; opening?: true }): Promise<void> {
    halt();
    const mine = ++generation;
    const next = new AbortController();
    controller = next;
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
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
      await request({ ghostId: id, text });
    },
    async speakOpening(ghostId) {
      const id = ghostId.trim();
      if (!id) return;
      await request({ ghostId: id, opening: true });
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
