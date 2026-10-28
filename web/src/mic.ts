export type BlowListener = {
  start(): Promise<void>;
  stop(): void;
};

/**
 * Later this wraps AnalyserNode and fires when the visitor blows.
 * Milestone 1 only reserves the shape.
 */
export function createBlowListener(_onBlow: () => void): BlowListener {
  return {
    async start() {
      return;
    },
    stop() {
      return;
    },
  };
}

export function blowDetectionStatus(): string {
  const listener = createBlowListener(() => undefined);
  listener.stop();
  return "The microphone is quiet for now. Blow into it once the candle scene is wired. Until then, talk to the ghost with POST /api/turn.";
}
