import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadProjectEnv } from "./env.js";
import { loadGhost } from "./ghosts.js";
import { createLlmProvider } from "./llm/index.js";
import { ghostsDir } from "./paths.js";
import type { Turn } from "./types.js";
import { parseHistory, parseTurnRequest } from "./turnRequest.js";

export type CliArgs = {
  help: boolean;
  ghostId: string;
  players: string[];
  historyJson?: string;
  http?: string;
};

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = { help: false, ghostId: "eliza", players: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--ghost") {
      args.ghostId = requireValue(argv, ++i, arg);
    } else if (arg === "--player" || arg === "--say") {
      args.players.push(requireValue(argv, ++i, arg));
    } else if (arg === "--history") {
      args.historyJson = requireValue(argv, ++i, arg);
    } else if (arg === "--http") {
      args.http = requireValue(argv, ++i, arg);
    } else {
      throw new Error(`Unknown argument ${arg}`);
    }
  }
  if (args.historyJson !== undefined && args.players.length > 0) {
    throw new Error("Use either --history or --player, not both");
  }
  return args;
}

export function historyFromArgs(args: CliArgs): Turn[] {
  if (args.historyJson !== undefined) return parseHistory(JSON.parse(args.historyJson));
  return args.players.map((text) => ({ role: "player" as const, text }));
}

const HELP = `Ask one ghost for its next line.

Usage:
  npm run turn -w server -- [--ghost eliza] [--player "text"] [--history '<json>'] [--http URL]

--ghost     Profile id under ghosts/. Default: eliza
--player    Append a visitor line. Repeat to add several. Alias: --say
--history   JSON array of {"role":"ghost"|"player","text":"..."}
--http      POST to a running API instead of calling the provider directly

LLM_PROVIDER picks the model. mock needs no key.
`;

async function main(): Promise<void> {
  loadProjectEnv();
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  const history = historyFromArgs(args);
  const request = parseTurnRequest({ ghostId: args.ghostId, history });

  if (args.http) {
    const url = `${args.http.replace(/\/+$/, "")}/api/turn`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${response.status} ${text}`);
    }
    process.stdout.write(`${text}\n`);
    return;
  }

  const llm = createLlmProvider(process.env);
  const ghost = loadGhost(ghostsDir(), request.ghostId);
  process.stderr.write(`llm=${llm.id} ghost=${ghost.id}\n`);
  const turn = await llm.nextTurn(ghost, request.history);
  process.stdout.write(`${JSON.stringify(turn, null, 2)}\n`);
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} needs a value`);
  return value;
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (invokedDirectly()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
