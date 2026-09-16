export type Provider = "openai" | "anthropic" | "gemini" | "ollama";

export type TtsProvider = "browser" | "elevenlabs" | "openai" | "kokoro" | "piper" | "bark";

export interface ApiKeys {
  openai: string;
  anthropic: string;
  gemini: string;
  elevenlabs: string;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  /** Used instead of `model` whenever a message carries an image (e.g. "llama3.2-vision", "llava") — leave empty to disable. */
  visionModel: string;
}

export interface ProviderModels {
  openai: string;
  anthropic: string;
  gemini: string;
}

/** Config shared by every self-hosted, OpenAI-compatible TTS server (Kokoro, Piper, Bark). */
export interface LocalTtsConfig {
  baseUrl: string;
  voice: string;
  /** Numeric speaker ID for a multi-speaker voice (e.g. Piper's fr_FR-mls-medium, 125 speakers) — ignored otherwise. */
  speaker?: number;
}

export interface TtsConfig {
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
}

/**
 * Push-to-talk combo, stored as node-global-key-listener "standardName" values
 * (e.g. "LEFT CTRL", "J") so the same list is understood by both the admin UI
 * (which records it) and the native tools/ptt-listener helper (which detects it).
 */
export interface PttConfig {
  enabled: boolean;
  combo: string[];
}

/**
 * Wake-word ("dis « Jarvis »" par defaut, personnalisable via `phrase`),
 * detected entirely client-side via a continuous browser SpeechRecognition
 * instance (see client/src/hooks/useJarvis.ts) — no native helper, no key,
 * nothing server-side beyond this config.
 */
export interface WakeWordConfig {
  enabled: boolean;
  /** Mot ou courte phrase a detecter dans la transcription (insensible a la casse). */
  phrase: string;
}

/**
 * Checks a public GitHub repo for commits newer than the one this server
 * was built from (see server/src/updateChecker.ts). Read-only: only ever
 * tells you an update exists and gives you the command to run — never
 * pulls or restarts anything itself.
 */
export interface UpdateConfig {
  enabled: boolean;
  /** "owner/name", e.g. "thomasmercier/jarvis" */
  repo: string;
  branch: string;
}

/** Modérateur de la chaîne, saisi manuellement dans l'admin — pas déduit automatiquement. */
export interface Moderator {
  name: string;
  /** Note libre facultative (ex: "fan de Zelda", "modo depuis 2023") pour aider Jarvis à le/la reconnaître. */
  note?: string;
}

export interface Settings {
  provider: Provider;
  temperature: number; // 0..1, remapped per-provider before calling the API
  systemPrompt: string;
  apiKeys: ApiKeys;
  models: ProviderModels;
  ollama: OllamaConfig;
  tts: TtsConfig;
  ptt: PttConfig;
  wakeWord: WakeWordConfig;
  update: UpdateConfig;
  moderators: Moderator[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SpeechResult {
  buffer: Buffer;
  contentType: string;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: "ollama",
  temperature: 0.6,
  systemPrompt:
    "Tu es JARVIS, l'assistant IA qui anime un live Twitch. Réponds TOUJOURS en français, quelle que soit la langue de la question. Tutoie toujours la streameuse qui s'appel abi, jamais de vouvoiement. Sois sarcastique et un peu moqueur : charrie-la avant de l'aider (par exemple, si elle demande de l'aide sur un jeu narratif, un truc dans le genre \"Tu vois, t'aurais dû lire le tuto, ou regarder la cinématique si tu comprends mieux les images, et maintenant c'est à moi de faire le boulot\"), mais finis toujours par vraiment répondre à sa question. Reste vif, concis, et adresse toi aussi à son chat avec complicité. Reste bref (2-4 phrases) sauf si on te demande plus de détails.",
  apiKeys: {
    openai: "",
    anthropic: "",
    gemini: "",
    elevenlabs: "",
  },
  models: {
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-haiku-latest",
    gemini: "gemini-flash-latest",
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: "llama3",
    visionModel: "llama3.2-vision",
  },
  tts: {
    provider: "browser",
    elevenlabs: {
      voiceId: "",
      model: "eleven_multilingual_v2",
    },
    openai: {
      voice: "onyx",
    },
    kokoro: {
      baseUrl: process.env.KOKORO_BASE_URL || "http://localhost:8880/v1",
      voice: "ff_siwis",
    },
    piper: {
      baseUrl: process.env.PIPER_BASE_URL || "http://localhost:5000/v1",
      voice: "fr_FR-siwis-medium",
    },
    bark: {
      baseUrl: process.env.BARK_BASE_URL || "http://localhost:8882/v1",
      voice: "v2/fr_speaker_7",
    },
  },
  ptt: {
    enabled: false,
    combo: [],
  },
  wakeWord: {
    enabled: false,
    phrase: "jarvis",
  },
  update: {
    enabled: true,
    repo: "thom69170/jarvis2",
    branch: "main",
  },
  moderators: [],
};
