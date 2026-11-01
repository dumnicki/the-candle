import floorboardUrl from "../assets/sfx/floorboard.mp3";
import footstepsUrl from "../assets/sfx/footsteps.mp3";
import shutterUrl from "../assets/sfx/distant-shutter-bang.mp3";
import toneUrl from "../assets/sfx/room-tone-draft-loop.mp3";
import woodCreakUrl from "../assets/sfx/wood-creak.mp3";
import { nextOneShotDelay, oneShotMix } from "./ambienceMix";

const ONE_SHOTS = [floorboardUrl, footstepsUrl, woodCreakUrl, shutterUrl];
const TONE_GAIN = 0.14;
const SILENCE_MS = 1_000;

export type RoomAmbience = {
  /** Starts after a click or a press. Browsers ignore sound before that. */
  start(): void;
  setLit(lit: boolean): void;
};

/** Quiet room tone under occasional creaks, steps, and a far shutter. */
export function createRoomAmbience(): RoomAmbience {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let bed: GainNode | null = null;
  let tone: AudioBufferSourceNode | null = null;
  let lit = true;
  let started = false;
  let shotTimer = 0;
  let quietUntil = 0;
  const shots = new Set<GainNode>();

  return {
    start() {
      if (started) return;
      const AudioCtx = window.AudioContext;
      if (!AudioCtx) return;
      started = true;
      context = new AudioCtx();
      master = context.createGain();
      master.gain.value = lit ? 1 : 0;
      master.connect(context.destination);
      bed = context.createGain();
      bed.gain.value = TONE_GAIN;
      bed.connect(master);
      void context.resume();
      void begin(context, bed);
    },
    setLit(next) {
      if (next === lit) return;
      lit = next;
      if (!context || !master) return;
      window.clearTimeout(shotTimer);
      shotTimer = 0;
      cut(context, master);
      if (!next) {
        quietUntil = Date.now() + SILENCE_MS;
        return;
      }
      const wait = Math.max(0, quietUntil - Date.now());
      window.setTimeout(() => {
        if (!context || !master || !lit) return;
        const at = context.currentTime;
        master.gain.cancelScheduledValues(at);
        master.gain.setValueAtTime(0, at);
        master.gain.linearRampToValueAtTime(1, at + 0.6);
        scheduleShot();
      }, wait);
    },
  };

  function cut(ctx: AudioContext, output: GainNode): void {
    const now = ctx.currentTime;
    output.gain.cancelScheduledValues(now);
    output.gain.setValueAtTime(output.gain.value, now);
    output.gain.linearRampToValueAtTime(0, now + 0.04);
    for (const shot of shots) {
      shot.gain.cancelScheduledValues(now);
      shot.gain.setValueAtTime(shot.gain.value, now);
      shot.gain.linearRampToValueAtTime(0, now + 0.04);
    }
  }

  async function begin(ctx: AudioContext, bedGain: GainNode): Promise<void> {
    const buffer = await loadBuffer(ctx, toneUrl);
    if (!buffer || tone) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(bedGain);
    source.start();
    tone = source;
    if (lit) scheduleShot();
  }

  function scheduleShot(): void {
    window.clearTimeout(shotTimer);
    if (!lit) return;
    shotTimer = window.setTimeout(() => {
      shotTimer = 0;
      if (!lit || !context) return;
      const url = ONE_SHOTS[Math.floor(Math.random() * ONE_SHOTS.length)] ?? ONE_SHOTS[0];
      void playShot(context, url);
      scheduleShot();
    }, nextOneShotDelay());
  }

  async function playShot(ctx: AudioContext, url: string): Promise<void> {
    if (!lit || !master) return;
    const buffer = await loadBuffer(ctx, url);
    if (!buffer || !lit || !master) return;
    const mix = oneShotMix();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = mix.gain;
    const pan = ctx.createStereoPanner();
    pan.pan.value = mix.pan;
    source.connect(gain);
    gain.connect(pan);
    pan.connect(master);
    shots.add(gain);
    source.onended = () => shots.delete(gain);
    source.start();
  }
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();

function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(url);
  if (cached) return cached;
  const pending = fetch(url)
    .then((response) => response.arrayBuffer())
    .then((bytes) => ctx.decodeAudioData(bytes))
    .catch(() => null);
  buffers.set(url, pending);
  return pending;
}
