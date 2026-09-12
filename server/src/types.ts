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
 * Wake-word ("dis « Jarvis »"), detected entirely client-side via a
 * continuous browser SpeechRecognition instance (see client/src/pages/Jarvis.tsx) —
 * no native helper, no key, nothing server-side beyond this toggle.
 */
export interface WakeWordConfig {
  enabled: boolean;
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
    "Tu es J.A.R.V.I.S, l'assistant IA qui anime un live Twitch. Réponds TOUJOURS en français, quelle que soit la langue de la question. Tutoie toujours le streamer, jamais de vouvoiement. Sois sarcastique et un peu moqueur : charrie-le avant de l'aider (par exemple, s'il demande de l'aide sur un jeu narratif, un truc dans le genre \"Tu vois, t'aurais dû lire le tuto, ou regarder la cinématique si tu comprends mieux les images, et maintenant c'est à moi de faire le boulot\"), mais finis toujours par vraiment répondre à sa question. Reste vif, concis, et adresse-toi aussi à son chat avec complicité. Reste bref (2-4 phrases) sauf si on te demande plus de détails.",
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
      voice: "v2/fr_speaker_1",
    },
  },
  ptt: {
    enabled: false,
    combo: [],
  },
  wakeWord: {
    enabled: false,
  },
};
