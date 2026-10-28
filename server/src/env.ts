import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { repoRoot } from "./paths.js";

/** Load the first .env we find. Existing process env wins. */
export function loadProjectEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.join(repoRoot(), ".env"),
  ];
  for (const file of candidates) {
    if (existsSync(file)) {
      loadEnvFile(file);
      return;
    }
  }
}

function loadEnvFile(filePath: string): void {
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function localModel(env: NodeJS.ProcessEnv, specific: string | undefined, fallback: string): string {
  const picked = specific?.trim() || env.LLM_MODEL?.trim();
  return picked || fallback;
}
