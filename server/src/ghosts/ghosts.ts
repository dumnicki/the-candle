import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { GhostNotFoundError } from "../errors.js";
import type { Ghost, VoiceConfig } from "../types.js";

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
  return parseGhost(data, id);
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
  };
}

function parseVoice(value: unknown, id: string): VoiceConfig {
  const record = asRecord(value, `ghost ${id} voice`);
  return {
    elevenlabs_voice_id: optionalString(record.elevenlabs_voice_id),
    piper_model: optionalString(record.piper_model),
  };
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
