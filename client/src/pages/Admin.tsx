import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  MemoryEntry,
  Moderator,
  PublicSettings,
  Provider,
  TtsProvider,
  UpdateCheckResult,
  checkForUpdate,
  deleteMemory,
  fetchMemories,
  fetchSettings,
  updateSettings,
} from "../api";
import { codeToGklName, formatCombo } from "../keyNames";

type KeyName = "openai" | "anthropic" | "gemini" | "elevenlabs";

const PROVIDER_INFO: Record<
  Provider,
  { label: string; needsKey: boolean }
> = {
  ollama: { label: "Ollama (local, gratuit)", needsKey: false },
  openai: { label: "OpenAI (GPT)", needsKey: true },
  anthropic: { label: "Anthropic (Claude)", needsKey: true },
  gemini: { label: "Google (Gemini)", needsKey: true },
};

const KEY_LINKS: Record<KeyName, { label: string; url: string }> = {
  openai: { label: "Générer une clé OpenAI", url: "https://platform.openai.com/api-keys" },
  anthropic: { label: "Générer une clé Anthropic", url: "https://console.anthropic.com/settings/keys" },
  gemini: { label: "Générer une clé Google AI Studio", url: "https://aistudio.google.com/app/apikey" },
  elevenlabs: { label: "Générer une clé ElevenLabs", url: "https://elevenlabs.io/app/settings/api-keys" },
};

const KEY_LABELS: Record<KeyName, string> = {
  openai: "OpenAI (GPT)",
  anthropic: "Anthropic (Claude)",
  gemini: "Google (Gemini)",
  elevenlabs: "ElevenLabs (voix)",
};

const TTS_PROVIDER_INFO: Record<TtsProvider, { label: string; needsKey: boolean }> = {
  browser: { label: "Navigateur (gratuit, qualité robotique)", needsKey: false },
  elevenlabs: { label: "ElevenLabs (la plus réaliste, clé payante)", needsKey: true },
  openai: { label: "OpenAI (réutilise la clé OpenAI ci-dessus)", needsKey: true },
  kokoro: { label: "Kokoro (local, gratuit, léger)", needsKey: false },
  piper: { label: "Piper (local, gratuit, très rapide)", needsKey: false },
  bark: { label: "Bark (local, gratuit, GPU conseillé)", needsKey: false },
};

const OPENAI_TTS_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer"];

// Uniquement les voix françaises de chaque moteur (voir VOIX_DISPONIBLES.txt
// pour le catalogue complet multilingue).
const KOKORO_FRENCH_VOICES = [{ id: "ff_siwis", label: "Siwis (voix féminine française)" }];

// Piper télécharge automatiquement la voix choisie ici si elle n'est pas
// déjà présente (voir server.py de kamilkrawiec/piper-openai-tts).
const PIPER_FRENCH_VOICES = [
  { id: "fr_FR-siwis-medium", label: "Siwis — qualité moyenne (recommandé, féminine)" },
  { id: "fr_FR-siwis-low", label: "Siwis — qualité basse (plus rapide, féminine)" },
  { id: "fr_FR-tom-medium", label: "Tom — qualité moyenne (masculine, ~130 Hz)" },
  { id: "fr_FR-gilles-low", label: "Gilles — qualité basse (masculine)" },
  { id: "fr_FR-upmc-medium", label: "UPMC — 2 locuteurs, 1 masculin + 1 féminin (choisir ci-dessous)" },
  { id: "fr_FR-mls-medium", label: "MLS — 125 locuteurs dont plusieurs masculins (choisir ci-dessous)" },
  { id: "fr_FR-mls_1840-low", label: "MLS 1840 — qualité basse" },
];

// UPMC (2 locuteurs) : genre identifie par mesure de hauteur de voix, comme
// pour le modele MLS ci-dessus.
const PIPER_UPMC_SPEAKERS = [
  { id: 1, label: "Locuteur 1 (masculin, ~126 Hz)" },
  { id: 0, label: "Locuteur 0 (féminin, ~221 Hz)" },
];

// Locuteurs du modele multi-voix MLS identifies par mesure de hauteur de
// voix (F0 median via autocorrelation sur un echantillon audio genere pour
// chacun) : ~12 des 25 locuteurs sondes sonnaient nettement masculins
// (F0 94-121 Hz) contre 0 pour Kokoro et une seule voix (Gilles) en Piper
// mono-locuteur.
const PIPER_MLS_SPEAKERS = [
  { id: 5, label: "Locuteur 5 (masculin, grave)" },
  { id: 0, label: "Locuteur 0 (masculin)" },
  { id: 67, label: "Locuteur 67 (masculin)" },
  { id: 98, label: "Locuteur 98 (masculin)" },
  { id: 21, label: "Locuteur 21 (masculin)" },
  { id: 78, label: "Locuteur 78 (masculin)" },
  { id: 57, label: "Locuteur 57 (féminin)" },
  { id: 88, label: "Locuteur 88 (féminin)" },
];

// Presets francais de Bark (v2/fr_speaker_0 a 9), genre identifie par mesure
// de hauteur de voix (F0 median) sur un echantillon audio genere pour
// chacun — les numeros seuls ne sont pas documentes/fiables par Suno.
const BARK_FRENCH_VOICES = [
  { id: "v2/fr_speaker_7", label: "Locuteur 7 — masculin, ~137 Hz (recommandé)" },
  { id: "v2/fr_speaker_0", label: "Locuteur 0 — masculin, ~137 Hz" },
  { id: "v2/fr_speaker_4", label: "Locuteur 4 — masculin/grave incertain, ~150 Hz" },
  { id: "v2/fr_speaker_8", label: "Locuteur 8 — masculin/grave incertain, ~152 Hz" },
  { id: "v2/fr_speaker_6", label: "Locuteur 6 — masculin/grave incertain, ~153 Hz" },
  { id: "v2/fr_speaker_9", label: "Locuteur 9 — incertain, ~171 Hz" },
  { id: "v2/fr_speaker_2", label: "Locuteur 2 — féminin, ~190 Hz" },
  { id: "v2/fr_speaker_5", label: "Locuteur 5 — féminin, ~220 Hz" },
  { id: "v2/fr_speaker_1", label: "Locuteur 1 — féminin, ~238 Hz" },
  { id: "v2/fr_speaker_3", label: "Locuteur 3 — féminin aigu, ~348 Hz" },
];

export default function Admin() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<KeyName, string>>({
    openai: "",
    anthropic: "",
    gemini: "",
    elevenlabs: "",
  });
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [recordingCombo, setRecordingCombo] = useState(false);
  const [liveCombo, setLiveCombo] = useState<string[]>([]);
  const recordedKeysRef = useRef<Set<string>>(new Set());
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckResult | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [memories, setMemories] = useState<MemoryEntry[] | null>(null);
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const [newModeratorName, setNewModeratorName] = useState("");
  const [newModeratorNote, setNewModeratorNote] = useState("");

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchMemories()
      .then(setMemories)
      .catch(() => undefined);
  }, []);

  async function handleDeleteMemory(id: string) {
    setDeletingMemoryId(id);
    try {
      await deleteMemory(id);
      setMemories((prev) => prev?.filter((m) => m.id !== id) ?? prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingMemoryId(null);
    }
  }

  useEffect(() => {
    checkForUpdate()
      .then(setUpdateCheck)
      .catch(() => undefined);
  }, []);

  async function handleCheckUpdate() {
    setCheckingUpdate(true);
    try {
      setUpdateCheck(await checkForUpdate());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCheckingUpdate(false);
    }
  }

  useEffect(() => {
    if (!recordingCombo) return;

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      const name = codeToGklName(e.code);
      if (name) {
        recordedKeysRef.current.add(name);
        setLiveCombo([...recordedKeysRef.current]);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      e.preventDefault();
      if (recordedKeysRef.current.size === 0) return;
      const finalCombo = [...recordedKeysRef.current];
      setRecordingCombo(false);
      setSettings((prev) => (prev ? { ...prev, ptt: { ...prev.ptt, combo: finalCombo } } : prev));
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [recordingCombo]);

  function startRecordingCombo() {
    recordedKeysRef.current = new Set();
    setLiveCombo([]);
    setRecordingCombo(true);
  }

  if (!settings) {
    return <Shell>{error ? <ErrorBox>{error}</ErrorBox> : <p>Chargement…</p>}</Shell>;
  }

  const update = (patch: Partial<PublicSettings>) =>
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));

  function handleAddModerator() {
    const name = newModeratorName.trim();
    if (!name || !settings) return;
    const note = newModeratorNote.trim() || undefined;
    update({ moderators: [...settings.moderators, { name, note }] });
    setNewModeratorName("");
    setNewModeratorNote("");
  }

  function handleRemoveModerator(index: number) {
    if (!settings) return;
    update({ moderators: settings.moderators.filter((_, i) => i !== index) });
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const apiKeys: Partial<Record<KeyName, string>> = {};
      (Object.keys(keyInputs) as KeyName[]).forEach((k) => {
        if (keyInputs[k].trim()) apiKeys[k] = keyInputs[k].trim();
      });

      const saved = await updateSettings({
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
        apiKeys,
      });
      setSettings(saved);
      setKeyInputs({ openai: "", anthropic: "", gemini: "", elevenlabs: "" });
      setStatus("Réglages enregistrés ✔");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleClearKey(key: KeyName) {
    setError("");
    try {
      const saved = await updateSettings({ clearKeys: [key] });
      setSettings(saved);
      setStatus(`Clé ${KEY_LABELS[key]} supprimée.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Shell>
      {updateCheck?.updateAvailable && (
        <div
          style={{
            background: "#0f2a1a",
            border: "1px solid var(--ok)",
            color: "var(--ok)",
            borderRadius: 8,
            padding: 14,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>
            🔔 Une nouvelle version de Jarvis est disponible ({updateCheck.currentSha?.slice(0, 7)} → {updateCheck.latestSha?.slice(0, 7)}).
          </span>
          {updateCheck.compareUrl && (
            <a href={updateCheck.compareUrl} target="_blank" rel="noreferrer" style={{ color: "var(--ok)" }}>
              Voir les changements ↗
            </a>
          )}
        </div>
      )}

      <Section title="Fournisseur IA">
        <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
          Choisis quel moteur répond dans le rôle de Jarvis. Les clés API sont{" "}
          <strong>facultatives</strong> : sans clé, choisis Ollama pour tout
          faire tourner en local, gratuitement.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {(Object.keys(PROVIDER_INFO) as Provider[]).map((p) => (
            <label
              key={p}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: settings.provider === p ? "var(--panel-alt)" : "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="provider"
                checked={settings.provider === p}
                onChange={() => update({ provider: p })}
              />
              {PROVIDER_INFO[p].label}
              {PROVIDER_INFO[p].needsKey && !settings.apiKeys[p as KeyName].set && (
                <span style={{ color: "var(--danger)", fontSize: 12 }}>
                  (clé manquante)
                </span>
              )}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Clés API (facultatives)">
        {(Object.keys(KEY_LINKS) as KeyName[]).map((key) => (
          <div key={key} style={rowStyle}>
            <div style={{ minWidth: 160 }}>
              <strong>{KEY_LABELS[key]}</strong>
              <div>
                <a href={KEY_LINKS[key].url} target="_blank" rel="noreferrer">
                  {KEY_LINKS[key].label} ↗
                </a>
              </div>
            </div>
            <input
              type="password"
              placeholder={
                settings.apiKeys[key].set
                  ? `Clé actuelle : ${settings.apiKeys[key].preview}`
                  : "Aucune clé configurée"
              }
              value={keyInputs[key]}
              onChange={(e) => setKeyInputs((prev) => ({ ...prev, [key]: e.target.value }))}
              style={inputStyle}
            />
            {settings.apiKeys[key].set && (
              <button style={ghostButton} onClick={() => handleClearKey(key)}>
                Supprimer
              </button>
            )}
          </div>
        ))}
      </Section>

      <Section title="Ollama (modèle local, sans clé API)">
        <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
          Pas encore installé ?{" "}
          <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
            Télécharger Ollama ↗
          </a>{" "}
          puis lance <code>ollama pull llama3</code> (ou un autre modèle) dans
          un terminal.
        </p>
        <div style={rowStyle}>
          <label style={{ minWidth: 160 }}>Adresse du serveur</label>
          <input
            style={inputStyle}
            value={settings.ollama.baseUrl}
            onChange={(e) => update({ ollama: { ...settings.ollama, baseUrl: e.target.value } })}
          />
        </div>
        <div style={rowStyle}>
          <label style={{ minWidth: 160 }}>Modèle (texte)</label>
          <input
            style={inputStyle}
            value={settings.ollama.model}
            onChange={(e) => update({ ollama: { ...settings.ollama, model: e.target.value } })}
          />
        </div>
        <div style={rowStyle}>
          <label style={{ minWidth: 160 }}>Modèle vision</label>
          <input
            style={inputStyle}
            placeholder="ex : llama3.2-vision, llava (laisse vide pour désactiver)"
            value={settings.ollama.visionModel}
            onChange={(e) => update({ ollama: { ...settings.ollama, visionModel: e.target.value } })}
          />
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: -6 }}>
          Utilisé automatiquement à la place du modèle texte uniquement
          quand tu partages la fenêtre du jeu — inutile de le charger pour
          les échanges de texte classiques. Pense à le télécharger d'abord :{" "}
          <code>ollama pull llama3.2-vision</code>.
        </p>
      </Section>

      <Section title="Voix de Jarvis (synthèse vocale)">
        <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
          Par défaut, Jarvis utilise la voix intégrée au navigateur (gratuite
          mais robotique). Pour une voix plus réaliste avec une clé API,
          choisis ElevenLabs ou OpenAI. Pour une voix gratuite et 100% locale
          (sans clé, sans envoyer le texte à un service en ligne), choisis
          Kokoro, Piper ou Bark — il faut alors lancer leur petit serveur en
          local (voir liens ci-dessous) avant d'utiliser Jarvis.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          {(Object.keys(TTS_PROVIDER_INFO) as TtsProvider[]).map((p) => (
            <label
              key={p}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: settings.tts.provider === p ? "var(--panel-alt)" : "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="ttsProvider"
                checked={settings.tts.provider === p}
                onChange={() => update({ tts: { ...settings.tts, provider: p } })}
              />
              {TTS_PROVIDER_INFO[p].label}
              {p === "elevenlabs" && !settings.apiKeys.elevenlabs.set && (
                <span style={{ color: "var(--danger)", fontSize: 12 }}>(clé manquante)</span>
              )}
              {p === "openai" && !settings.apiKeys.openai.set && (
                <span style={{ color: "var(--danger)", fontSize: 12 }}>(clé manquante)</span>
              )}
            </label>
          ))}
        </div>

        {settings.tts.provider === "elevenlabs" && (
          <>
            <div style={rowStyle}>
              <label style={{ minWidth: 160 }}>ID de la voix</label>
              <input
                style={inputStyle}
                placeholder="ex : copie l'ID depuis ta bibliothèque de voix ElevenLabs"
                value={settings.tts.elevenlabs.voiceId}
                onChange={(e) =>
                  update({ tts: { ...settings.tts, elevenlabs: { ...settings.tts.elevenlabs, voiceId: e.target.value } } })
                }
              />
            </div>
            <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: -6 }}>
              Choisis une voix dans ta{" "}
              <a href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noreferrer">
                bibliothèque de voix ElevenLabs ↗
              </a>{" "}
              et colle son ID ici.
            </p>
            <div style={rowStyle}>
              <label style={{ minWidth: 160 }}>Modèle</label>
              <input
                style={inputStyle}
                value={settings.tts.elevenlabs.model}
                onChange={(e) =>
                  update({ tts: { ...settings.tts, elevenlabs: { ...settings.tts.elevenlabs, model: e.target.value } } })
                }
              />
            </div>
          </>
        )}

        {settings.tts.provider === "openai" && (
          <div style={rowStyle}>
            <label style={{ minWidth: 160 }}>Voix</label>
            <select
              style={inputStyle}
              value={settings.tts.openai.voice}
              onChange={(e) => update({ tts: { ...settings.tts, openai: { voice: e.target.value } } })}
            >
              {OPENAI_TTS_VOICES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        )}

        {settings.tts.provider === "kokoro" && (
          <>
            <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 0 }}>
              Lance d'abord un serveur{" "}
              <a href="https://github.com/remsky/Kokoro-FastAPI" target="_blank" rel="noreferrer">
                Kokoro-FastAPI ↗
              </a>{" "}
              en local, par exemple avec Docker :{" "}
              <code>docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest</code>
            </p>
            <div style={rowStyle}>
              <label style={{ minWidth: 160 }}>Adresse du serveur</label>
              <input
                style={inputStyle}
                value={settings.tts.kokoro.baseUrl}
                onChange={(e) => update({ tts: { ...settings.tts, kokoro: { ...settings.tts.kokoro, baseUrl: e.target.value } } })}
              />
            </div>
            <div style={rowStyle}>
              <label style={{ minWidth: 160 }}>Voix</label>
              <select
                style={inputStyle}
                value={settings.tts.kokoro.voice}
                onChange={(e) => update({ tts: { ...settings.tts, kokoro: { ...settings.tts.kokoro, voice: e.target.value } } })}
              >
                {KOKORO_FRENCH_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {settings.tts.provider === "piper" && (
          <>
            <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 0 }}>
              Lance d'abord un serveur{" "}
              <a href="https://github.com/rhasspy/piper" target="_blank" rel="noreferrer">
                Piper ↗
              </a>{" "}
              exposant une API compatible OpenAI, par exemple avec Docker :{" "}
              <code>docker run -p 5000:5000 kamilkrawiec/piper-openai-tts</code>
            </p>
            <div style={rowStyle}>
              <label style={{ minWidth: 160 }}>Adresse du serveur</label>
              <input
                style={inputStyle}
                value={settings.tts.piper.baseUrl}
                onChange={(e) => update({ tts: { ...settings.tts, piper: { ...settings.tts.piper, baseUrl: e.target.value } } })}
              />
            </div>
            <div style={rowStyle}>
              <label style={{ minWidth: 160 }}>Voix</label>
              <select
                style={inputStyle}
                value={settings.tts.piper.voice}
                onChange={(e) => update({ tts: { ...settings.tts, piper: { ...settings.tts.piper, voice: e.target.value } } })}
              >
                {PIPER_FRENCH_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            {settings.tts.piper.voice === "fr_FR-mls-medium" && (
              <div style={rowStyle}>
                <label style={{ minWidth: 160 }}>Locuteur</label>
                <select
                  style={inputStyle}
                  value={settings.tts.piper.speaker ?? 5}
                  onChange={(e) =>
                    update({ tts: { ...settings.tts, piper: { ...settings.tts.piper, speaker: Number(e.target.value) } } })
                  }
                >
                  {PIPER_MLS_SPEAKERS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {settings.tts.piper.voice === "fr_FR-upmc-medium" && (
              <div style={rowStyle}>
                <label style={{ minWidth: 160 }}>Locuteur</label>
                <select
                  style={inputStyle}
                  value={settings.tts.piper.speaker ?? 1}
                  onChange={(e) =>
                    update({ tts: { ...settings.tts, piper: { ...settings.tts.piper, speaker: Number(e.target.value) } } })
                  }
                >
                  {PIPER_UPMC_SPEAKERS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
              Le serveur Piper télécharge automatiquement la voix choisie si
              elle n'est déjà pas installée — le premier message avec une
              nouvelle voix peut prendre quelques secondes de plus le temps
              du téléchargement, les suivants seront normaux.
            </p>
          </>
        )}

        {settings.tts.provider === "bark" && (
          <>
            <WarningBox>
              <strong>Attention aux performances :</strong> Bark tourne sur ta
              carte graphique (GPU). Si tu joues et streames en même temps sur
              la même carte, la génération de chaque phrase peut provoquer des
              saccades ou des chutes de FPS dans le jeu. Sur CPU seul, c'est
              encore plus lent (plusieurs secondes, voire dizaines de
              secondes par phrase). À réserver aux répliques ponctuelles, pas
              à un chat qui déclenche Jarvis en continu.
            </WarningBox>
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
              Bark (
              <a href="https://github.com/suno-ai/bark" target="_blank" rel="noreferrer">
                suno-ai/bark ↗
              </a>
              ) n'a pas de serveur officiel : utilise le petit serveur Python
              fourni dans <code>tools/bark-server</code> de ce projet
              (voir le README pour l'installation), qui expose une API
              compatible OpenAI sur l'adresse ci-dessous.
            </p>
            <div style={rowStyle}>
              <label style={{ minWidth: 160 }}>Adresse du serveur</label>
              <input
                style={inputStyle}
                value={settings.tts.bark.baseUrl}
                onChange={(e) => update({ tts: { ...settings.tts, bark: { ...settings.tts.bark, baseUrl: e.target.value } } })}
              />
            </div>
            <div style={rowStyle}>
              <label style={{ minWidth: 160 }}>Voix (preset)</label>
              <select
                style={inputStyle}
                value={settings.tts.bark.voice}
                onChange={(e) => update({ tts: { ...settings.tts, bark: { ...settings.tts.bark, voice: e.target.value } } })}
              >
                {BARK_FRENCH_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </Section>

      <Section title="Push-to-talk (parler à Jarvis avec une touche)">
        <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
          Maintiens une combinaison de touches pour parler à Jarvis au micro,
          relâche pour envoyer. Ça fonctionne{" "}
          <strong>même en jeu, fenêtre non focus</strong> grâce à un petit
          programme séparé à lancer sur ta machine :{" "}
          <code>tools/ptt-listener</code> (voir son README). Il ne fonctionne
          pas dans Docker — il a besoin d'un accès direct au clavier de
          Windows.
        </p>
        <WarningBox>
          Sur certaines machines (notamment avec <strong>Smart App Control</strong>{" "}
          de Windows 11 activé), Windows peut bloquer ce programme par
          réputation : un décrocheur clavier global ressemble techniquement à
          un logiciel malveillant. Si ça arrive, préfère le mot d'activation
          ci-dessous, qui n'a pas ce problème.
        </WarningBox>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={settings.ptt.enabled}
            onChange={(e) => update({ ptt: { ...settings.ptt, enabled: e.target.checked } })}
          />
          Activer le push-to-talk
        </label>
        {settings.ptt.enabled && (
          <>
            <div style={rowStyle}>
              <label style={{ minWidth: 160 }}>Combinaison actuelle</label>
              <strong style={{ color: "var(--cyan)" }}>
                {recordingCombo ? formatCombo(liveCombo) || "…" : formatCombo(settings.ptt.combo)}
              </strong>
            </div>
            <button
              style={recordingCombo ? primaryButton : ghostButtonNeutral}
              onClick={startRecordingCombo}
              disabled={recordingCombo}
            >
              {recordingCombo ? "Maintiens les touches, puis relâche…" : "Enregistrer une nouvelle combinaison"}
            </button>
          </>
        )}
      </Section>

      <Section title={`Mot d'activation (dire « ${settings.wakeWord.phrase || "Jarvis"} »)`}>
        <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
          Dis le mot choisi ci-dessous pour que Jarvis t'écoute
          automatiquement, sans toucher au clavier. Tourne{" "}
          <strong>entièrement dans le navigateur</strong> (aucun programme
          séparé à installer, aucun risque de blocage Windows) via la
          reconnaissance vocale intégrée — l'onglet Jarvis doit juste rester
          ouvert (il peut rester en arrière-plan).
        </p>
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: -6 }}>
          Contrepartie : contrairement au push-to-talk, l'audio transite par
          le service de reconnaissance vocale du navigateur (Google pour
          Chrome/Edge) tant que l'écoute est active, pas seulement le temps
          d'une commande.
        </p>
        <div style={rowStyle}>
          <label style={{ minWidth: 160 }}>Mot ou phrase à dire</label>
          <input
            style={inputStyle}
            placeholder="ex : Jarvis"
            value={settings.wakeWord.phrase}
            onChange={(e) => update({ wakeWord: { ...settings.wakeWord, phrase: e.target.value } })}
          />
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 4 }}>
          Choisis un mot pas trop courant dans une conversation normale —
          sinon Jarvis va se déclencher tout seul par erreur. Par exemple,
          <strong> « quelqu'un »</strong> techniquement ça marche, mais c'est
          un très mauvais choix : ce mot revient sans arrêt dans une phrase
          normale. Préfère un prénom ou un mot inhabituel (« Jarvis »,
          « Ordinateur »...).
        </p>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={settings.wakeWord.enabled}
            onChange={(e) => update({ wakeWord: { ...settings.wakeWord, enabled: e.target.checked } })}
          />
          Activer le mot d'activation
        </label>
      </Section>

      <Section title="Température de la réponse">
        <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
          Plus la valeur est haute, plus Jarvis improvise et varie ses
          réponses. Plus elle est basse, plus il reste factuel et prévisible.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.temperature}
            onChange={(e) => update({ temperature: Number(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ width: 48, textAlign: "right", color: "var(--cyan)" }}>
            {settings.temperature.toFixed(2)}
          </span>
        </div>
      </Section>

      <Section title="Personnalité de Jarvis">
        <textarea
          value={settings.systemPrompt}
          onChange={(e) => update({ systemPrompt: e.target.value })}
          rows={4}
          style={{ ...inputStyle, width: "100%", resize: "vertical" }}
        />
      </Section>

      <Section title="Mémoire de Jarvis">
        <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
          Jarvis retient tout seul les faits durables qu'il apprend sur toi
          ou le stream (ton jeu du moment, une préférence, une blague
          récurrente...) et s'en ressert dans les conversations suivantes,
          même après un redémarrage. Pas de contrôle direct sur ce qu'il
          retient — seulement la liste ci-dessous pour vérifier et
          supprimer ce qui ne devrait pas y être.
        </p>
        {memories === null && <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Chargement…</p>}
        {memories?.length === 0 && (
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Rien retenu pour l'instant.</p>
        )}
        {memories && memories.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {memories.map((m) => (
              <li
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  background: "var(--panel-alt)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                <span style={{ fontSize: 14 }}>{m.text}</span>
                <button
                  onClick={() => handleDeleteMemory(m.id)}
                  disabled={deletingMemoryId === m.id}
                  style={{
                    background: "transparent",
                    color: "var(--danger)",
                    border: "1px solid var(--danger)",
                    borderRadius: 6,
                    padding: "2px 8px",
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {deletingMemoryId === m.id ? "…" : "Supprimer"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Modérateurs">
        <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
          Renseigne les modérateurs de la chaîne pour que Jarvis sache qui
          est qui s'ils sont mentionnés dans une conversation ou le chat.
          Contrairement à la mémoire ci-dessus, cette liste est saisie à la
          main, pas déduite automatiquement.
        </p>
        <div style={{ ...rowStyle, alignItems: "flex-start" }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Nom du modérateur"
            value={newModeratorName}
            onChange={(e) => setNewModeratorName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddModerator()}
          />
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Note facultative (ex : fan de Zelda)"
            value={newModeratorNote}
            onChange={(e) => setNewModeratorNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddModerator()}
          />
          <button onClick={handleAddModerator} style={ghostButtonNeutral}>
            Ajouter
          </button>
        </div>
        {settings.moderators.length === 0 && (
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Aucun modérateur renseigné.</p>
        )}
        {settings.moderators.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {settings.moderators.map((m, i) => (
              <li
                key={`${m.name}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  background: "var(--panel-alt)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                <span style={{ fontSize: 14 }}>
                  <strong>{m.name}</strong>
                  {m.note && <span style={{ color: "var(--text-dim)" }}> — {m.note}</span>}
                </span>
                <button
                  onClick={() => handleRemoveModerator(i)}
                  style={{
                    background: "transparent",
                    color: "var(--danger)",
                    border: "1px solid var(--danger)",
                    borderRadius: 6,
                    padding: "2px 8px",
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
        <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          N'oublie pas de cliquer sur « Enregistrer » en bas de page pour sauvegarder.
        </p>
      </Section>

      <Section title="Modèles utilisés (avancé)">
        <div style={rowStyle}>
          <label style={{ minWidth: 160 }}>OpenAI</label>
          <input
            style={inputStyle}
            value={settings.models.openai}
            onChange={(e) => update({ models: { ...settings.models, openai: e.target.value } })}
          />
        </div>
        <div style={rowStyle}>
          <label style={{ minWidth: 160 }}>Anthropic</label>
          <input
            style={inputStyle}
            value={settings.models.anthropic}
            onChange={(e) => update({ models: { ...settings.models, anthropic: e.target.value } })}
          />
        </div>
        <div style={rowStyle}>
          <label style={{ minWidth: 160 }}>Gemini</label>
          <input
            style={inputStyle}
            value={settings.models.gemini}
            onChange={(e) => update({ models: { ...settings.models, gemini: e.target.value } })}
          />
        </div>
      </Section>

      <Section title="Mises à jour">
        <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
          Vérifie si une nouvelle version de Jarvis existe sur GitHub. Lecture
          seule : ça ne fait jamais de <code>git pull</code> ni de
          redémarrage tout seul — juste un signal, à toi de lancer la mise à
          jour.
        </p>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={settings.update.enabled}
            onChange={(e) => update({ update: { ...settings.update, enabled: e.target.checked } })}
          />
          Vérifier automatiquement au chargement de cette page
        </label>
        <div style={rowStyle}>
          <label style={{ minWidth: 160 }}>Dépôt GitHub</label>
          <input
            style={inputStyle}
            placeholder="ex : ton-pseudo/jarvis"
            value={settings.update.repo}
            onChange={(e) => update({ update: { ...settings.update, repo: e.target.value } })}
          />
        </div>
        <div style={rowStyle}>
          <label style={{ minWidth: 160 }}>Branche</label>
          <input
            style={inputStyle}
            value={settings.update.branch}
            onChange={(e) => update({ update: { ...settings.update, branch: e.target.value } })}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
          <button style={ghostButtonNeutral} onClick={handleCheckUpdate} disabled={checkingUpdate}>
            {checkingUpdate ? "Vérification…" : "Vérifier maintenant"}
          </button>
          {updateCheck?.checked && !updateCheck.updateAvailable && (
            <span style={{ color: "var(--ok)", fontSize: 13 }}>
              ✔ À jour ({updateCheck.currentSha?.slice(0, 7)})
            </span>
          )}
          {updateCheck?.error && <span style={{ color: "var(--danger)", fontSize: 13 }}>{updateCheck.error}</span>}
        </div>
        {updateCheck?.updateAvailable && (
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 12 }}>
            Pour mettre à jour : double-clique sur <code>update.bat</code> à la
            racine du projet (télécharge et reconstruit tout seul, pas besoin
            de Git). Avec Git installé, tu peux aussi faire ça à la main dans
            un terminal à la racine du projet :
            <br />
            <code>git pull</code>
            {" — puis, si tu utilises Docker : "}
            <code>docker compose build && docker compose up -d</code>
          </p>
        )}
      </Section>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
        <button style={primaryButton} onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer les réglages"}
        </button>
        <Link to="/jarvis" target="_blank">
          Ouvrir la fenêtre Jarvis ↗
        </Link>
        <Link to="/overlay" target="_blank">
          Ouvrir la vue OBS (visuel seul) ↗
        </Link>
      </div>

      {status && <p style={{ color: "var(--ok)" }}>{status}</p>}
      {error && <ErrorBox>{error}</ErrorBox>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 20px 80px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ color: "var(--cyan)", letterSpacing: 2 }}>Administration J.A.R.V.I.S</h1>
        <Link to="/">← Accueil</Link>
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <h2 style={{ fontSize: 16, marginTop: 0, color: "var(--text)" }}>{title}</h2>
      {children}
    </section>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#2a1414",
        border: "1px solid var(--danger)",
        color: "var(--danger)",
        borderRadius: 8,
        padding: 12,
      }}
    >
      {children}
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#2a2410",
        border: "1px solid #f5c542",
        color: "#f5c542",
        borderRadius: 8,
        padding: 12,
        fontSize: 13,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  flexWrap: "wrap",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 220,
  background: "var(--panel-alt)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--text)",
};

const primaryButton: React.CSSProperties = {
  background: "var(--cyan)",
  color: "#04222b",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontWeight: 600,
};

const ghostButton: React.CSSProperties = {
  background: "transparent",
  color: "var(--danger)",
  border: "1px solid var(--danger)",
  borderRadius: 6,
  padding: "6px 10px",
};

const ghostButtonNeutral: React.CSSProperties = {
  background: "transparent",
  color: "var(--cyan)",
  border: "1px solid var(--cyan-dim)",
  borderRadius: 6,
  padding: "8px 14px",
};
