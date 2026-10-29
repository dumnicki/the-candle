import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root, whether this file is running from src/config via tsx or from dist/config. */
export function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../..");
}

export function ghostsDir(): string {
  return process.env.GHOSTS_DIR || path.join(repoRoot(), "ghosts");
}
