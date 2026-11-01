import type { GhostChoice, TurnRequest, TurnResult } from "../types.js";

const MAX_LINE = 5000;
const MAX_OPTION = 2000;

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiClient = {
  listGhosts(): Promise<GhostChoice[]>;
  sendTurn(request: TurnRequest): Promise<TurnResult>;
};

export function createApiClient(fetchImpl: typeof fetch = fetch): ApiClient {
  return {
    async listGhosts() {
      const body = await readJson(fetchImpl, "/api/ghosts");
      return parseGhostCatalog(body);
    },
    async sendTurn(request) {
      const body = await readJson(fetchImpl, "/api/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      return parseTurnResponse(body);
    },
  };
}

export function parseGhostCatalog(body: unknown): GhostChoice[] {
  const record = asRecord(body, "The house did not answer with a ghost list.");
  if (!Array.isArray(record.ghosts)) {
    throw new ApiError("The house did not answer with a ghost list.");
  }
  return record.ghosts.map((item) => parseGhostChoice(item));
}

export function parseTurnResponse(body: unknown): TurnResult {
  const record = asRecord(body, "The ghost's reply was unreadable.");
  if (typeof record.ghost_line !== "string") {
    throw new ApiError("The ghost's reply was missing a line.");
  }
  const ghostLine = record.ghost_line.trim();
  if (!ghostLine || ghostLine.length > MAX_LINE) {
    throw new ApiError("The ghost's reply was missing a line.");
  }
  const options = parseOptions(record.options);
  const stage = record.reveal_stage;
  if (typeof stage !== "number" || !Number.isInteger(stage) || stage < 0) {
    throw new ApiError("The ghost's reply had no reveal stage.");
  }
  const turn: TurnResult = { ghost_line: ghostLine, options, reveal_stage: stage };
  if (typeof record.thread_id === "string" && record.thread_id.trim()) {
    turn.thread_id = record.thread_id.trim();
  } else if (record.thread_id != null && typeof record.thread_id !== "string") {
    throw new ApiError("The ghost's reply was unreadable.");
  }
  return turn;
}

function parseGhostChoice(value: unknown): GhostChoice {
  const record = asRecord(value, "A ghost in the list was unreadable.");
  const id = requiredText(record.id, "A ghost in the list was unreadable.");
  const name = requiredText(record.name, "A ghost in the list was unreadable.");
  const era = requiredText(record.era, "A ghost in the list was unreadable.");
  const stages = record.reveal_stages;
  if (typeof stages !== "number" || !Number.isInteger(stages) || stages < 1) {
    throw new ApiError("A ghost in the list was unreadable.");
  }
  return { id, name, era, reveal_stages: stages };
}

function parseOptions(value: unknown): string[] {
  if (!Array.isArray(value)) throw new ApiError("The ghost's reply did not include choices.");
  const options: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") throw new ApiError("The ghost's reply included a choice that was not text.");
    const text = item.trim();
    if (!text || text.length > MAX_OPTION) {
      throw new ApiError("The ghost's reply included a choice that was not text.");
    }
    options.push(text);
  }
  return options;
}

async function readJson(fetchImpl: typeof fetch, path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(path, init);
  } catch {
    throw new ApiError("The page cannot reach the API. Start it with npm run dev, then try again.");
  }
  if (!response.ok) throw new ApiError(await errorMessage(response));
  try {
    return await response.json();
  } catch {
    throw new ApiError("The ghost's reply was unreadable.");
  }
}

async function errorMessage(response: Response): Promise<string> {
  let message = "";
  try {
    const body = await response.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      message = body.error.trim();
    }
  } catch {
    message = "";
  }
  if (message) return clamp(message);
  if (response.status === 500 || response.status === 502 || response.status === 504) {
    return "The page cannot reach the API. Start it with npm run dev, then try again.";
  }
  return `The room could not answer (${response.status}).`;
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(message);
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, message: string): string {
  if (typeof value !== "string") throw new ApiError(message);
  const text = value.trim();
  if (!text) throw new ApiError(message);
  return text;
}

function clamp(message: string): string {
  if (message.length <= 280) return message;
  return `${message.slice(0, 277)}...`;
}
