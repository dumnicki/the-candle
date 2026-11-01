import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { GhostNotFoundError } from "../errors.js";
import type { ElevenLabsVoiceSettings, Ghost, VoiceConfig } from "../types.js";

const ID_PATTERN = /^[a-z0-9_-]+$/;

/** Public facts for the picker. The secret and the opening line stay on the server. */
export type GhostSummary = {
  id: string;
  name: string;
  era: string;
  reveal_stages: number;
};

export function listGhosts(dir: string): GhostSummary[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    throw new Error("Ghosts directory is missing");
  }
  const summaries: GhostSummary[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -".json".length);
    if (!ID_PATTERN.test(id)) continue;
    const file = path.join(dir, name);
    try {
      if (!statSync(file).isFile()) continue;
    } catch {
      continue;
    }
    const ghost = loadGhost(dir, id);
    summaries.push({
      id: ghost.id,
      name: ghost.name,
      era: ghost.era,
      reveal_stages: ghost.reveal_stages,
    });
  }
  summaries.sort((left, right) => left.id.localeCompare(right.id));
  return summaries;
}

export function loadGhost(dir: string, id: string): Ghost {
  if (!ID_PATTERN.test(id)) throw new GhostNotFoundError(id);
  const file = path.join(dir, `${id}.json`);
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    throw new GhostNotFoundError(id);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Ghost file ${id}.json is not valid JSON`);
  }
  const ghost = parseGhost(data, id);
  assertKnownTies(dir, ghost);
  return ghost;
}

function parseGhost(data: unknown, id: string): Ghost {
  const record = asRecord(data, `ghost ${id}`);
  const fileId = requiredString(record, "id", id);
  if (fileId !== id) {
    throw new Error(`Ghost file ${id}.json declares id "${fileId}"`);
  }
  const stages = record.reveal_stages;
  if (typeof stages !== "number" || !Number.isInteger(stages) || stages < 1) {
    throw new Error(`Ghost ${id} reveal_stages must be a positive integer`);
  }
  const ties = parseTies(record.ties, id);
  return {
    id,
    name: requiredString(record, "name", id),
    era: requiredString(record, "era", id),
    personality: requiredString(record, "personality", id),
    backstory: requiredString(record, "backstory", id),
    secret: requiredString(record, "secret", id),
    opening_line: requiredString(record, "opening_line", id),
    voice: parseVoice(record.voice, id),
    reveal_stages: stages,
    ...(ties ? { ties } : {}),
  };
}

const FILTERS = new Set([
  "old_radio",
  "robot",
  "cheap_microphone",
  "phone",
  "low_quality_phone",
  "bright_phone",
]);
const ROOMS = new Set(["small_room", "big_room", "hall", "tunnel", "street", "valley", "forest"]);
const NOISES = new Set(["call_center", "cafe", "city", "keyboard"]);
const BOND_LIMIT = 240;

function parseVoice(value: unknown, id: string): VoiceConfig {
  const record = asRecord(value, `ghost ${id} voice`);
  const settings = parseVoiceSettings(record.settings);
  const effects = parseEffects(record.effects, id);
  const modelId = parseModelId(record.model_id, id);
  return {
    elevenlabs_voice_id: optionalString(record.elevenlabs_voice_id),
    ...(modelId ? { model_id: modelId } : {}),
    piper_model: optionalString(record.piper_model),
    ...(settings ? { settings } : {}),
    ...(effects ? { effects } : {}),
  };
}

function parseModelId(value: unknown, id: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" || !/^[a-z0-9_]+$/.test(value.trim())) {
    throw new Error(`Ghost ${id} voice.model_id is not a model id`);
  }
  return value.trim();
}

function parseEffects(value: unknown, id: string): VoiceConfig["effects"] | undefined {
  if (value == null) return undefined;
  const record = asRecord(value, `ghost ${id} voice.effects`);
  const effects: NonNullable<VoiceConfig["effects"]> = {};
  const filter = enumId(record.filter_preset_id, FILTERS, `Ghost ${id} voice.effects.filter_preset_id`);
  const room = enumId(record.environment_id, ROOMS, `Ghost ${id} voice.effects.environment_id`);
  const noise = enumId(record.background_noise_id, NOISES, `Ghost ${id} voice.effects.background_noise_id`);
  const distance = unitOrThrow(record.distance, `Ghost ${id} voice.effects.distance`);
  const send = unitOrThrow(record.send_level, `Ghost ${id} voice.effects.send_level`);
  const pan = rangedOrThrow(record.pan, -1, 1, `Ghost ${id} voice.effects.pan`);
  if (filter) effects.filter_preset_id = filter;
  if (room) effects.environment_id = room;
  if (noise) effects.background_noise_id = noise;
  if (distance != null) effects.distance = distance;
  if (send != null) effects.send_level = send;
  if (pan != null) effects.pan = pan;
  return Object.keys(effects).length > 0 ? effects : undefined;
}

function enumId(value: unknown, allowed: Set<string>, label: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new Error(`${label} is not a known effect`);
  }
  return value;
}

function unitOrThrow(value: unknown, label: string): number | undefined {
  return rangedOrThrow(value, 0, 1, label);
}

function rangedOrThrow(value: unknown, min: number, max: number, label: string): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} is out of range`);
  }
  return value;
}

function parseTies(value: unknown, id: string): Ghost["ties"] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new Error(`Ghost ${id} ties must be an array`);
  const seen = new Set<string>();
  const ties: NonNullable<Ghost["ties"]> = [];
  for (const item of value) {
    const record = asRecord(item, `ghost ${id} tie`);
    const other = requiredString(record, "id", id);
    if (!ID_PATTERN.test(other)) throw new Error(`Ghost ${id} ties to invalid id "${other}"`);
    if (other === id) throw new Error(`Ghost ${id} cannot tie to itself`);
    if (seen.has(other)) throw new Error(`Ghost ${id} ties to ${other} more than once`);
    seen.add(other);
    const bond = requiredString(record, "bond", id);
    if (bond.length > BOND_LIMIT) throw new Error(`Ghost ${id} bond for ${other} is too long`);
    ties.push({ id: other, bond });
  }
  return ties.length > 0 ? ties : undefined;
}

function assertKnownTies(dir: string, ghost: Ghost): void {
  for (const tie of ghost.ties ?? []) {
    const file = path.join(dir, `${tie.id}.json`);
    let isFile = false;
    try {
      isFile = statSync(file).isFile();
    } catch {
      isFile = false;
    }
    if (!isFile) throw new Error(`Ghost ${ghost.id} ties to unknown ghost ${tie.id}`);
  }
}

function parseVoiceSettings(value: unknown): ElevenLabsVoiceSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const settings: ElevenLabsVoiceSettings = {};
  const stability = unit(record.stability);
  const similarity = unit(record.similarity_boost);
  const style = unit(record.style);
  const speed = ranged(record.speed, 0.7, 1.2);
  if (stability != null) settings.stability = stability;
  if (similarity != null) settings.similarity_boost = similarity;
  if (style != null) settings.style = style;
  if (speed != null) settings.speed = speed;
  if (typeof record.use_speaker_boost === "boolean") settings.use_speaker_boost = record.use_speaker_boost;
  return Object.keys(settings).length > 0 ? settings : undefined;
}

function unit(value: unknown): number | undefined {
  return ranged(value, 0, 1);
}

function ranged(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return undefined;
  return value;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string, id: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Ghost ${id} is missing ${key}`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
