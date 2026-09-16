import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const MEMORY_FILE = path.join(DATA_DIR, "memory.json");

/** Evite une derive sans fin du prompt systeme : les plus vieux souvenirs sont oublies en premier. */
const MAX_MEMORIES = 50;

export interface MemoryEntry {
  id: string;
  text: string;
  createdAt: string;
}

function ensureDataFile(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(MEMORY_FILE)) {
    writeFileSync(MEMORY_FILE, "[]", "utf-8");
  }
}

export function loadMemories(): MemoryEntry[] {
  ensureDataFile();
  const raw = readFileSync(MEMORY_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMemories(memories: MemoryEntry[]): void {
  ensureDataFile();
  writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2), "utf-8");
}

/** Ignore les doublons quasi-identiques ; renvoie null si rien n'a ete ajoute. */
export function addMemory(text: string): MemoryEntry | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const memories = loadMemories();
  const normalized = trimmed.toLowerCase();
  if (memories.some((m) => m.text.trim().toLowerCase() === normalized)) {
    return null;
  }

  const entry: MemoryEntry = { id: randomUUID(), text: trimmed, createdAt: new Date().toISOString() };
  memories.push(entry);
  while (memories.length > MAX_MEMORIES) {
    memories.shift();
  }
  saveMemories(memories);
  return entry;
}

export function deleteMemory(id: string): boolean {
  const memories = loadMemories();
  const next = memories.filter((m) => m.id !== id);
  if (next.length === memories.length) return false;
  saveMemories(next);
  return true;
}
