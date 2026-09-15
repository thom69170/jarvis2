import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PublicSettings, Provider, TtsProvider, UpdateCheckResult, checkForUpdate, fetchSettings, updateSettings } from "../api";
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
  { id: "fr_FR-siwis-medium", label: "Siwis — qualité moyenne (recommandé)" },
  { id: "fr_FR-siwis-low", label: "Siwis — qualité basse (plus rapide)" },
  { id: "fr_FR-gilles-low", label: "Gilles — qualité basse (voix masculine)" },
  { id: "fr_FR-mls-medium", label: "MLS (125 locuteurs) — qualité moyenne" },
  { id: "fr_FR-mls_1840-low", label: "MLS 1840 — qualité basse" },
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

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, []);

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
              <input
                style={inputStyle}
                placeholder="ex : v2/fr_speaker_1"
                value={settings.tts.bark.voice}
                onChange={(e) => update({ tts: { ...settings.tts, bark: { ...settings.tts.bark, voice: e.target.value } } })}
              />
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

      <Section title="Mot d'activation (dire « Jarvis »)">
        <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
          Dis « Jarvis » pour qu'il t'écoute automatiquement, sans toucher au
          clavier. Tourne <strong>entièrement dans le navigateur</strong>{" "}
          (aucun programme séparé à installer, aucun risque de blocage
          Windows) via la reconnaissance vocale intégrée — l'onglet Jarvis
          doit juste rester ouvert (il peut rester en arrière-plan).
        </p>
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: -6 }}>
          Contrepartie : contrairement au push-to-talk, l'audio transite par
          le service de reconnaissance vocale du navigateur (Google pour
          Chrome/Edge) tant que l'écoute est active, pas seulement le temps
          d'une commande.
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
