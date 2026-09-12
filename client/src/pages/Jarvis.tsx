import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PublicSettings } from "../api";
import { Orb } from "../components/Orb";
import { useJarvis } from "../hooks/useJarvis";

const TTS_PROVIDER_LABELS: Record<PublicSettings["tts"]["provider"], string> = {
  browser: "synthèse vocale du navigateur",
  elevenlabs: "ElevenLabs",
  openai: "OpenAI",
  kokoro: "Kokoro (local)",
  piper: "Piper (local)",
  bark: "Bark (local)",
};

export default function Jarvis() {
  const [params] = useSearchParams();
  const transparent = params.get("transparent") === "1";
  const [input, setInput] = useState("");

  const {
    messages,
    orbState,
    errorMsg,
    ttsEnabled,
    setTtsEnabled,
    voices,
    voiceName,
    setVoiceName,
    ttsProvider,
    ptt,
    wakeWord,
    micGranted,
    enableMic,
    wakeStatus,
    wakeTranscript,
    sendMessage,
    screenShared,
    shareScreen,
    stopScreenShare,
  } = useJarvis();

  async function handleSend() {
    const text = input;
    setInput("");
    await sendMessage(text);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: transparent ? "transparent" : "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 24,
      }}
    >
      <Orb state={orbState} />

      <div style={{ minHeight: 32, textAlign: "center", maxWidth: 560 }}>
        {errorMsg ? (
          <span style={{ color: "var(--danger)" }}>{errorMsg}</span>
        ) : (
          <span style={{ color: "var(--text)", fontSize: 18 }}>
            {messages.filter((m) => m.role === "assistant").slice(-1)[0]?.content ?? "En attente…"}
          </span>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{ display: "flex", gap: 10, width: "100%", maxWidth: 560 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Parle à Jarvis…"
          style={{
            flex: 1,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 14px",
            color: "var(--text)",
          }}
        />
        <button
          type="submit"
          style={{
            background: "var(--cyan)",
            color: "#04222b",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontWeight: 600,
          }}
        >
          Envoyer
        </button>
      </form>

      {(ptt.enabled || wakeWord.enabled) && !micGranted && (
        <button
          onClick={enableMic}
          style={{
            background: "transparent",
            color: "var(--cyan)",
            border: "1px solid var(--cyan-dim)",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
          }}
        >
          Activer le micro (requis pour le push-to-talk / le mot d'activation)
        </button>
      )}

      {wakeWord.enabled && micGranted && (
        <div style={{ fontSize: 13, color: "var(--text-dim)", margin: 0, textAlign: "center" }}>
          <p style={{ margin: 0 }}>
            {wakeStatus === "listening" ? "🎙️" : "⏸️"} Mot d'activation «
            Jarvis » : {wakeStatus === "listening" ? "en écoute" : "arrêté"}
          </p>
          {wakeTranscript && (
            <p style={{ margin: "2px 0 0", fontStyle: "italic", opacity: 0.7 }}>
              Dernier son capté : « {wakeTranscript} »
            </p>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13, color: "var(--text-dim)" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={ttsEnabled} onChange={(e) => setTtsEnabled(e.target.checked)} />
          Voix ({TTS_PROVIDER_LABELS[ttsProvider]})
        </label>
        {ttsEnabled && ttsProvider === "browser" && voices.length > 0 && (
          <select
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            style={{ background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6 }}
          >
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        )}
      </div>

      <button
        onClick={screenShared ? stopScreenShare : shareScreen}
        style={{
          background: screenShared ? "var(--panel-alt)" : "transparent",
          color: screenShared ? "var(--ok)" : "var(--cyan)",
          border: `1px solid ${screenShared ? "var(--ok)" : "var(--cyan-dim)"}`,
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
        }}
      >
        {screenShared ? "🎮 Partage actif — arrêter" : "🎮 Partager la fenêtre du jeu"}
      </button>

      <MessageLog messages={messages} transparent={transparent} />

      <p style={{ fontSize: 12, color: "var(--text-dim)", opacity: 0.7 }}>
        Besoin d'une vue épurée pour OBS ?{" "}
        <a href="/overlay" target="_blank" rel="noreferrer">
          Ouvre la fenêtre visuel seul ↗
        </a>
      </p>
    </div>
  );
}

function MessageLog({
  messages,
  transparent,
}: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  transparent: boolean;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  return (
    <div
      ref={logRef}
      style={{
        width: "100%",
        maxWidth: 560,
        maxHeight: 160,
        overflowY: "auto",
        fontSize: 12,
        color: "var(--text-dim)",
        background: transparent ? "rgba(0,0,0,0.3)" : "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 10,
      }}
    >
      {messages.length === 0 && <p>L'historique de conversation apparaîtra ici.</p>}
      {messages.map((m, i) => (
        <p key={i} style={{ margin: "4px 0" }}>
          <strong style={{ color: m.role === "user" ? "var(--text)" : "var(--cyan)" }}>
            {m.role === "user" ? "Toi" : "Jarvis"}:
          </strong>{" "}
          {m.content}
        </p>
      ))}
    </div>
  );
}
