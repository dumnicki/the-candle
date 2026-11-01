export type BlowListener = {
  start(): Promise<void>;
  stop(): void;
};

export type BlowTrack = {
  hardSince: number | null;
};

/** A breath this strong bends the flame. */
export const BLOW_LEVEL = 0.28;

/** A breath this strong, held briefly, puts the flame out. */
export const EXTINGUISH_LEVEL = 0.72;

const HOLD_MS = 280;
const QUIET_RMS = 0.02;
const FULL_RMS = 0.14;

/** 0 is room noise, 1 is a hard blow. Samples are the analyser’s −1..1 waveform. */
export function levelFromSamples(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i] ?? 0;
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / samples.length);
  return Math.min(1, Math.max(0, (rms - QUIET_RMS) / (FULL_RMS - QUIET_RMS)));
}

export function createBlowTrack(): BlowTrack {
  return { hardSince: null };
}

/** A soft blow only leans the flame. A hard one has to last a moment. */
export function trackBlow(
  track: BlowTrack,
  level: number,
  now: number,
): { blowing: boolean; extinguish: boolean } {
  if (level < BLOW_LEVEL) {
    track.hardSince = null;
    return { blowing: false, extinguish: false };
  }
  if (level < EXTINGUISH_LEVEL) {
    track.hardSince = null;
    return { blowing: true, extinguish: false };
  }
  if (track.hardSince == null) track.hardSince = now;
  return { blowing: true, extinguish: now - track.hardSince >= HOLD_MS };
}

/**
 * Listens for a breath. The stream is never played back.
 * Echo cancellation and auto-gain stay off so a blow is not flattened.
 */
export function createBlowListener(onLevel: (level: number) => void): BlowListener {
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let frame = 0;
  let opening: Promise<void> | null = null;
  let stopped = false;
  const samples = new Float32Array(2048);

  return {
    start() {
      if (stream) return Promise.resolve();
      if (!opening) opening = open().catch((error: unknown) => {
        opening = null;
        throw error;
      });
      return opening;
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      void context?.close();
      context = null;
      opening = null;
    },
  };

  async function open(): Promise<void> {
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    const next = await navigator.mediaDevices.getUserMedia({ audio });
    if (stopped) {
      next.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = next;
    context = new AudioContext();
    await context.resume();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = samples.length;
    source.connect(analyser);
    const read = () => {
      analyser.getFloatTimeDomainData(samples);
      onLevel(levelFromSamples(samples));
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
  }
}
