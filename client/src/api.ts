export type Provider = "openai" | "anthropic" | "gemini" | "ollama";
export type TtsProvider = "browser" | "elevenlabs" | "openai" | "kokoro" | "piper" | "bark";

export interface KeyStatus {
  set: boolean;
  preview: string;
}

/** Modérateur de la chaîne, saisi manuellement dans l'admin — pas déduit automatiquement. */
export interface Moderator {
  name: string;
  note?: string;
}

/** Config shared by every self-hosted, OpenAI-compatible TTS server (Kokoro, Piper, Bark). */
export interface LocalTtsConfig {
  baseUrl: string;
  voice: string;
  /** Numeric speaker ID for a multi-speaker voice (e.g. Piper's fr_FR-mls-medium, 125 speakers) — ignored otherwise. */
  speaker?: number;
}

export interface PublicSettings {
  provider: Provider;
  temperature: number;
  systemPrompt: string;
  models: {
    openai: string;
    anthropic: string;
    gemini: string;
  };
  ollama: {
    baseUrl: string;
    model: string;
    visionModel: string;
  };
  tts: {
    provider: TtsProvider;
    elevenlabs: {
      voiceId: string;
      model: string;
    };
    openai: {
      voice: string;
    };
    kokoro: LocalTtsConfig;
    piper: LocalTtsConfig;
    bark: LocalTtsConfig;
  };
  ptt: {
    enabled: boolean;
    combo: string[];
  };
  wakeWord: {
    enabled: boolean;
    phrase: string;
  };
  update: {
    enabled: boolean;
    repo: string;
    branch: string;
  };
  moderators: Moderator[];
  /** Taille (en pixels) de l'avatar sur /overlay — reglable dans l'admin, remplacee par ?size=NNN dans l'URL si present. */
  overlaySize: number;
  apiKeys: {
    openai: KeyStatus;
    anthropic: KeyStatus;
    gemini: KeyStatus;
    elevenlabs: KeyStatus;
  };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erreur HTTP ${res.status}`);
  }
  return data as T;
}

export async function fetchSettings(): Promise<PublicSettings> {
  const res = await fetch("/api/settings");
  return handle<PublicSettings>(res);
}

export interface SettingsUpdate {
  provider?: Provider;
  temperature?: number;
  systemPrompt?: string;
  models?: Partial<PublicSettings["models"]>;
  ollama?: Partial<PublicSettings["ollama"]>;
  tts?: {
    provider?: TtsProvider;
    elevenlabs?: Partial<PublicSettings["tts"]["elevenlabs"]>;
    openai?: Partial<PublicSettings["tts"]["openai"]>;
    kokoro?: Partial<LocalTtsConfig>;
    piper?: Partial<LocalTtsConfig>;
    bark?: Partial<LocalTtsConfig>;
  };
  ptt?: Partial<PublicSettings["ptt"]>;
  wakeWord?: Partial<PublicSettings["wakeWord"]>;
  update?: Partial<PublicSettings["update"]>;
  moderators?: Moderator[];
  overlaySize?: number;
  apiKeys?: Partial<Record<"openai" | "anthropic" | "gemini" | "elevenlabs", string>>;
  clearKeys?: Array<"openai" | "anthropic" | "gemini" | "elevenlabs">;
}

export async function updateSettings(update: SettingsUpdate): Promise<PublicSettings> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  return handle<PublicSettings>(res);
}

/** `image`: base64 JPEG (no data: prefix), e.g. a screenshot of the shared game window — ignored by providers/models without vision support. */
/** `clientId` : identifie cet onglet pour qu'il ignore l'écho de son propre échange sur /api/chat/stream (voir useJarvis.ts). */
export async function sendChat(
  messages: ChatMessage[],
  image?: string,
  clientId?: string
): Promise<{ reply: string; provider: Provider }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, image, clientId }),
  });
  return handle<{ reply: string; provider: Provider }>(res);
}

export interface ChatExchange {
  clientId: string;
  userText: string;
  reply: string;
}

export interface UpdateCheckResult {
  checked: boolean;
  updateAvailable: boolean;
  currentSha: string | null;
  latestSha: string | null;
  compareUrl: string | null;
  error: string | null;
}

/** Read-only: asks the server to compare its build against the latest commit on GitHub. Never pulls or restarts anything. */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const res = await fetch("/api/update/check");
  return handle<UpdateCheckResult>(res);
}

/** Fetches synthesized speech audio for the given text. Throws if the server-side TTS provider fails or is unconfigured. */
export async function fetchTtsAudio(text: string): Promise<Blob> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur HTTP ${res.status}`);
  }
  return res.blob();
}

export interface MemoryEntry {
  id: string;
  text: string;
  createdAt: string;
}

/** Faits que Jarvis a appris tout seul au fil des conversations (voir server/src/chatEngine.ts). */
export async function fetchMemories(): Promise<MemoryEntry[]> {
  const res = await fetch("/api/memory");
  const data = await handle<{ memories: MemoryEntry[] }>(res);
  return data.memories;
}

export async function deleteMemory(id: string): Promise<void> {
  const res = await fetch(`/api/memory/${encodeURIComponent(id)}`, { method: "DELETE" });
  await handle<{ ok: boolean }>(res);
}
