import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS, Settings } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

function ensureDataFile(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(SETTINGS_FILE)) {
    writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
  }
}

export function loadSettings(): Settings {
  ensureDataFile();
  const raw = readFileSync(SETTINGS_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  // Merge with defaults so newly-added fields don't break existing installs.
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...parsed.apiKeys },
    models: { ...DEFAULT_SETTINGS.models, ...parsed.models },
    ollama: { ...DEFAULT_SETTINGS.ollama, ...parsed.ollama },
    tts: {
      ...DEFAULT_SETTINGS.tts,
      ...parsed.tts,
      elevenlabs: { ...DEFAULT_SETTINGS.tts.elevenlabs, ...parsed.tts?.elevenlabs },
      openai: { ...DEFAULT_SETTINGS.tts.openai, ...parsed.tts?.openai },
      kokoro: { ...DEFAULT_SETTINGS.tts.kokoro, ...parsed.tts?.kokoro },
      piper: { ...DEFAULT_SETTINGS.tts.piper, ...parsed.tts?.piper },
      bark: { ...DEFAULT_SETTINGS.tts.bark, ...parsed.tts?.bark },
    },
    ptt: { ...DEFAULT_SETTINGS.ptt, ...parsed.ptt },
    wakeWord: { ...DEFAULT_SETTINGS.wakeWord, ...parsed.wakeWord },
    update: { ...DEFAULT_SETTINGS.update, ...parsed.update },
  };
}

export function saveSettings(settings: Settings): void {
  ensureDataFile();
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "••••";
  return `••••${key.slice(-4)}`;
}

/** Shape returned to the frontend: never leak full API keys back out. */
export function toPublicSettings(settings: Settings) {
  return {
    provider: settings.provider,
    temperature: settings.temperature,
    systemPrompt: settings.systemPrompt,
    models: settings.models,
    ollama: settings.ollama,
    tts: settings.tts,
    ptt: settings.ptt,
    wakeWord: settings.wakeWord,
    update: settings.update,
    moderators: settings.moderators,
    overlaySize: settings.overlaySize,
    apiKeys: {
      openai: { set: !!settings.apiKeys.openai, preview: maskKey(settings.apiKeys.openai) },
      anthropic: { set: !!settings.apiKeys.anthropic, preview: maskKey(settings.apiKeys.anthropic) },
      gemini: { set: !!settings.apiKeys.gemini, preview: maskKey(settings.apiKeys.gemini) },
      elevenlabs: { set: !!settings.apiKeys.elevenlabs, preview: maskKey(settings.apiKeys.elevenlabs) },
    },
  };
}
