import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The commit this server was built/run from.
 * - In the Docker image, baked in at build time into dist/GIT_SHA (see server/Dockerfile).
 * - In native dev (`npm run dev`), read live from the repo `.git` this file lives in.
 */
export function getCurrentCommitSha(): string | null {
  const bakedPath = path.join(__dirname, "GIT_SHA");
  if (existsSync(bakedPath)) {
    const sha = readFileSync(bakedPath, "utf-8").trim();
    return sha || null;
  }
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: __dirname, encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

export interface UpdateCheckResult {
  checked: boolean;
  updateAvailable: boolean;
  currentSha: string | null;
  latestSha: string | null;
  compareUrl: string | null;
  error: string | null;
}

/** Read-only: queries GitHub's public API for the latest commit on `branch`. Never runs git pull or anything that changes files. */
export async function checkForUpdate(repo: string, branch: string): Promise<UpdateCheckResult> {
  const currentSha = getCurrentCommitSha();
  const empty: UpdateCheckResult = {
    checked: false,
    updateAvailable: false,
    currentSha,
    latestSha: null,
    compareUrl: null,
    error: null,
  };

  if (!repo) {
    return { ...empty, error: "Aucun dépôt GitHub configuré." };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "jarvis-update-checker" },
    });
    if (!res.ok) {
      return { ...empty, error: `GitHub a répondu ${res.status} — vérifie le nom du dépôt ("owner/nom") et la branche.` };
    }
    const data = (await res.json()) as { sha?: string };
    const latestSha = data.sha ?? null;
    const updateAvailable = !!currentSha && !!latestSha && currentSha !== latestSha;
    return {
      checked: true,
      updateAvailable,
      currentSha,
      latestSha,
      compareUrl: currentSha && latestSha ? `https://github.com/${repo}/compare/${currentSha}...${latestSha}` : `https://github.com/${repo}/commits/${branch}`,
      error: null,
    };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "Erreur réseau inconnue." };
  }
}
