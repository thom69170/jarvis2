import cors from "cors";
import express from "express";
import { MissingApiKeyError, generateReply } from "./chatEngine.js";
import { loadSettings, saveSettings, toPublicSettings } from "./settingsStore.js";
import { MissingTtsConfigError, generateSpeech } from "./ttsEngine.js";
import { ChatMessage, Provider, TtsProvider } from "./types.js";
import { checkForUpdate, UpdateCheckResult } from "./updateChecker.js";

const app = express();
const PORT = process.env.JARVIS_SERVER_PORT ? Number(process.env.JARVIS_SERVER_PORT) : 4000;

app.use(cors());
// Higher limit than the default 100kb: chat requests can carry a base64 JPEG
// screenshot of the game window (see /api/chat below).
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/settings", (_req, res) => {
  const settings = loadSettings();
  res.json(toPublicSettings(settings));
});

const VALID_PROVIDERS: Provider[] = ["openai", "anthropic", "gemini", "ollama"];

app.put("/api/settings", (req, res) => {
  const settings = loadSettings();
  const body = req.body ?? {};

  if (body.provider !== undefined) {
    if (!VALID_PROVIDERS.includes(body.provider)) {
      res.status(400).json({ error: "Fournisseur invalide." });
      return;
    }
    settings.provider = body.provider;
  }

  if (body.temperature !== undefined) {
    const temp = Number(body.temperature);
    if (Number.isNaN(temp) || temp < 0 || temp > 1) {
      res.status(400).json({ error: "La température doit être comprise entre 0 et 1." });
      return;
    }
    settings.temperature = temp;
  }

  if (typeof body.systemPrompt === "string") {
    settings.systemPrompt = body.systemPrompt;
  }

  if (body.models) {
    settings.models = { ...settings.models, ...body.models };
  }

  if (body.ollama) {
    settings.ollama = { ...settings.ollama, ...body.ollama };
  }

  if (body.tts) {
    const VALID_TTS_PROVIDERS: TtsProvider[] = ["browser", "elevenlabs", "openai", "kokoro", "piper", "bark"];
    if (body.tts.provider !== undefined) {
      if (!VALID_TTS_PROVIDERS.includes(body.tts.provider)) {
        res.status(400).json({ error: "Fournisseur de voix invalide." });
        return;
      }
      settings.tts.provider = body.tts.provider;
    }
    if (body.tts.elevenlabs) {
      settings.tts.elevenlabs = { ...settings.tts.elevenlabs, ...body.tts.elevenlabs };
    }
    if (body.tts.openai) {
      settings.tts.openai = { ...settings.tts.openai, ...body.tts.openai };
    }
    if (body.tts.kokoro) {
      settings.tts.kokoro = { ...settings.tts.kokoro, ...body.tts.kokoro };
    }
    if (body.tts.piper) {
      settings.tts.piper = { ...settings.tts.piper, ...body.tts.piper };
    }
    if (body.tts.bark) {
      settings.tts.bark = { ...settings.tts.bark, ...body.tts.bark };
    }
  }

  if (body.ptt) {
    if (typeof body.ptt.enabled === "boolean") {
      settings.ptt.enabled = body.ptt.enabled;
    }
    if (Array.isArray(body.ptt.combo) && body.ptt.combo.every((k: unknown) => typeof k === "string")) {
      settings.ptt.combo = body.ptt.combo;
    }
  }

  if (body.wakeWord) {
    if (typeof body.wakeWord.enabled === "boolean") {
      settings.wakeWord.enabled = body.wakeWord.enabled;
    }
    if (typeof body.wakeWord.phrase === "string") {
      settings.wakeWord.phrase = body.wakeWord.phrase;
    }
  }

  if (body.update) {
    if (typeof body.update.enabled === "boolean") {
      settings.update.enabled = body.update.enabled;
    }
    if (typeof body.update.repo === "string") {
      settings.update.repo = body.update.repo.trim();
    }
    if (typeof body.update.branch === "string" && body.update.branch.trim()) {
      settings.update.branch = body.update.branch.trim();
    }
  }

  // apiKeys: any non-empty string sets/overwrites the key.
  if (body.apiKeys) {
    for (const key of ["openai", "anthropic", "gemini", "elevenlabs"] as const) {
      if (typeof body.apiKeys[key] === "string" && body.apiKeys[key].length > 0) {
        settings.apiKeys[key] = body.apiKeys[key];
      }
    }
  }

  // clearKeys: explicit request to remove a previously-saved key (keys stay optional).
  if (Array.isArray(body.clearKeys)) {
    for (const key of body.clearKeys as unknown[]) {
      if (key === "openai" || key === "anthropic" || key === "gemini" || key === "elevenlabs") {
        settings.apiKeys[key as "openai" | "anthropic" | "gemini" | "elevenlabs"] = "";
      }
    }
  }

  saveSettings(settings);
  res.json(toPublicSettings(settings));
});

app.post("/api/chat", async (req, res) => {
  const settings = loadSettings();
  const messages: ChatMessage[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
  // Optional screenshot of the game window (see client/src/hooks/useJarvis.ts);
  // strip a data: URL prefix defensively in case the caller left it in.
  const rawImage = typeof req.body?.image === "string" ? req.body.image : undefined;
  const image = rawImage ? rawImage.replace(/^data:image\/\w+;base64,/, "") : undefined;

  if (messages.length === 0) {
    res.status(400).json({ error: "Aucun message fourni." });
    return;
  }

  try {
    const reply = await generateReply(settings, messages, image);
    res.json({ reply, provider: settings.provider });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      res.status(400).json({ error: error.message, code: "missing_api_key" });
      return;
    }
    console.error("Erreur pendant la génération de la réponse Jarvis:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    res.status(502).json({ error: message });
  }
});

app.post("/api/tts", async (req, res) => {
  const settings = loadSettings();
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

  if (!text) {
    res.status(400).json({ error: "Aucun texte fourni." });
    return;
  }

  try {
    const { buffer, contentType } = await generateSpeech(settings, text);
    res.setHeader("Content-Type", contentType);
    res.send(buffer);
  } catch (error) {
    if (error instanceof MissingTtsConfigError) {
      res.status(400).json({ error: error.message, code: "missing_tts_config" });
      return;
    }
    console.error("Erreur pendant la synthèse vocale de Jarvis:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    res.status(502).json({ error: message });
  }
});

// Push-to-talk: the native tools/ptt-listener helper (which alone has access to
// global keyboard events) POSTs press/release here; we relay them over SSE to
// whichever Jarvis browser tab(s) are listening.
const pttClients = new Set<express.Response>();

app.get("/api/ptt/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(": connected\n\n");

  pttClients.add(res);
  req.on("close", () => {
    pttClients.delete(res);
  });
});

function broadcastPtt(eventName: "press" | "release"): void {
  for (const client of pttClients) {
    client.write(`event: ${eventName}\ndata: {}\n\n`);
  }
}

app.post("/api/ptt/press", (_req, res) => {
  broadcastPtt("press");
  res.json({ ok: true, listeners: pttClients.size });
});

app.post("/api/ptt/release", (_req, res) => {
  broadcastPtt("release");
  res.json({ ok: true, listeners: pttClients.size });
});

// Read-only update check against the public GitHub repo: never pulls or
// restarts anything itself, just tells the admin panel whether a newer
// commit exists on the tracked branch.
async function runUpdateCheck(): Promise<UpdateCheckResult> {
  const settings = loadSettings();
  if (!settings.update.enabled) {
    return { checked: false, updateAvailable: false, currentSha: null, latestSha: null, compareUrl: null, error: null };
  }
  const result = await checkForUpdate(settings.update.repo, settings.update.branch);
  if (result.updateAvailable) {
    console.log(
      `[update] Nouvelle version disponible sur ${settings.update.repo}@${settings.update.branch} (actuel: ${result.currentSha?.slice(0, 7)}, dernier: ${result.latestSha?.slice(0, 7)}).`
    );
  }
  return result;
}

app.get("/api/update/check", async (_req, res) => {
  res.json(await runUpdateCheck());
});

app.listen(PORT, () => {
  console.log(`J.A.R.V.I.S server ready on http://localhost:${PORT}`);
  runUpdateCheck().catch((error) => console.error("Erreur pendant la vérification de mise à jour:", error));
});
