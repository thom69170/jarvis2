import { useEffect, useRef, useState } from "react";
import { ChatMessage, PublicSettings, fetchSettings, fetchTtsAudio, sendChat } from "../api";
import { OrbState } from "../components/Orb";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

/**
 * All of Jarvis's "brain": chat state, TTS playback, push-to-talk (via SSE
 * relay from tools/ptt-listener) and the in-browser wake word listener.
 * Shared by the full control page (client/src/pages/Jarvis.tsx) and the
 * visual-only OBS page (client/src/pages/Overlay.tsx) so both behave
 * identically — the only difference between them is what they render.
 */
export function useJarvis() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string>("");
  const [ttsProvider, setTtsProvider] = useState<PublicSettings["tts"]["provider"]>("browser");
  const [ptt, setPtt] = useState<PublicSettings["ptt"]>({ enabled: false, combo: [] });
  const [wakeWord, setWakeWord] = useState<PublicSettings["wakeWord"]>({ enabled: false, phrase: "jarvis" });
  const [micGranted, setMicGranted] = useState(false);
  const [wakeStatus, setWakeStatus] = useState<"stopped" | "listening">("stopped");
  const [wakeTranscript, setWakeTranscript] = useState("");
  const [screenShared, setScreenShared] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeActiveRef = useRef(false);
  const wakeFatalErrorRef = useRef(false);
  const wakeRestartTimerRef = useRef<number | null>(null);
  const wakeRetryDelayRef = useRef(300);
  const wakeRegexRef = useRef<RegExp>(/\bjarvis\b/i);
  const orbStateRef = useRef<OrbState>("idle");
  const wakeWordEnabledRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const speakRef = useRef<(text: string) => void>(() => undefined);

  useEffect(() => {
    orbStateRef.current = orbState;
  }, [orbState]);

  useEffect(() => {
    wakeWordEnabledRef.current = wakeWord.enabled;
  }, [wakeWord.enabled]);

  useEffect(() => {
    const phrase = (wakeWord.phrase || "jarvis").trim();
    if (!phrase) {
      wakeRegexRef.current = /(?!)/; // ne matche jamais si la phrase est vide
      return;
    }
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    wakeRegexRef.current = new RegExp(`\\b${escaped}\\b`, "i");
  }, [wakeWord.phrase]);

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setTtsProvider(s.tts.provider);
        setPtt(s.ptt);
        setWakeWord(s.wakeWord);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    function loadVoices() {
      const v = window.speechSynthesis?.getVoices() ?? [];
      setVoices(v);
      if (!voiceName && v.length) {
        const frVoice = v.find((voice) => voice.lang.startsWith("fr"));
        setVoiceName((frVoice ?? v[0]).name);
      }
    }
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function speakWithBrowser(text: string) {
    if (!window.speechSynthesis) {
      setOrbState("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find((v) => v.name === voiceName);
    if (voice) utterance.voice = voice;
    utterance.onend = () => setOrbState("idle");
    utterance.onerror = () => setOrbState("idle");
    setOrbState("speaking");
    window.speechSynthesis.speak(utterance);
  }

  async function speak(text: string) {
    if (!ttsEnabled) {
      setOrbState("idle");
      return;
    }

    if (ttsProvider === "browser") {
      speakWithBrowser(text);
      return;
    }

    try {
      const blob = await fetchTtsAudio(text);
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setOrbState("idle");
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setOrbState("idle");
        URL.revokeObjectURL(url);
      };
      setOrbState("speaking");
      await audio.play();
    } catch (e) {
      // Voix serveur indisponible (clé manquante, quota, etc.) : on retombe sur la voix du navigateur.
      setErrorMsg(e instanceof Error ? e.message : String(e));
      speakWithBrowser(text);
    }
  }

  useEffect(() => {
    speakRef.current = speak;
  });

  // Screen sharing: lets Jarvis "see" the game window. Only a fresh frame is
  // captured right when a message is sent (not streamed continuously) to
  // keep bandwidth/cost down — attaching it is silently skipped by
  // providers/models without vision support (e.g. Ollama with a non-vision
  // model like the default llama3).
  async function shareScreen() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      screenStreamRef.current = stream;
      screenVideoRef.current = video;
      setScreenShared(true);
      setErrorMsg("");
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopScreenShare());
    } catch (e) {
      setErrorMsg("Impossible de partager la fenêtre : " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function stopScreenShare() {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    screenVideoRef.current = null;
    setScreenShared(false);
  }

  function captureFrame(): string | undefined {
    const video = screenVideoRef.current;
    if (!video || video.readyState < 2) return undefined;
    const maxWidth = 1024;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
  }

  async function sendMessage(rawText: string) {
    const text = rawText.trim();
    if (!text) {
      setOrbState("idle");
      return;
    }
    setErrorMsg("");
    const nextMessages: ChatMessage[] = [...messagesRef.current, { role: "user", content: text }];
    setMessages(nextMessages);
    setOrbState("thinking");
    try {
      const image = captureFrame();
      const { reply } = await sendChat(nextMessages, image);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
      speakRef.current(reply);
    } catch (e) {
      setOrbState("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }

  function getRecognition(): SpeechRecognitionLike | null {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return null;
    if (!recognitionRef.current) {
      const r: SpeechRecognitionLike = new Ctor();
      r.lang = "fr-FR";
      r.continuous = false;
      r.interimResults = false;
      recognitionRef.current = r;
    }
    return recognitionRef.current;
  }

  function beginVoiceCapture() {
    const recognition = getRecognition();
    if (!recognition) {
      setErrorMsg("La reconnaissance vocale n'est pas supportée par ce navigateur (essaie Chrome ou Edge).");
      return;
    }
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) sendMessage(transcript);
    };
    recognition.onerror = () => setOrbState("idle");
    recognition.onend = () => {
      setOrbState((prev) => (prev === "listening" ? "idle" : prev));
    };
    setErrorMsg("");
    setOrbState("listening");
    try {
      recognition.start();
    } catch {
      // Already started (e.g. wake word fired twice quickly) — ignore.
    }
  }

  function endVoiceCapture() {
    recognitionRef.current?.stop();
  }

  async function enableMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicGranted(true);
      setErrorMsg("");
    } catch (e) {
      setErrorMsg("Impossible d'accéder au micro : " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Push-to-talk: the native tools/ptt-listener helper detects the global
  // key combo and POSTs press/release to the server, which relays them here.
  useEffect(() => {
    if (!ptt.enabled) return;
    const es = new EventSource("/api/ptt/stream");
    es.addEventListener("press", () => beginVoiceCapture());
    es.addEventListener("release", () => endVoiceCapture());
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptt.enabled]);

  // Wake word ("Jarvis"): runs entirely in the browser, no external helper.
  // A second, continuous SpeechRecognition instance scans everything said
  // while idle; when it hears "jarvis" it hands off to the normal one-shot
  // capture (same as PTT). It's paused whenever we're not idle (listening,
  // thinking, speaking) so it doesn't pick up Jarvis's own voice or overlap
  // with the command-capture recognition instance.
  function ensureWakeRecognition(): SpeechRecognitionLike | null {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return null;
    if (wakeRecognitionRef.current) return wakeRecognitionRef.current;

    wakeFatalErrorRef.current = false;
    const r: SpeechRecognitionLike = new Ctor();
    r.lang = "fr-FR";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event: any) => {
      const results = event.results;
      const transcript: string = results?.[results.length - 1]?.[0]?.transcript ?? "";
      setWakeTranscript(transcript);
      if (wakeRegexRef.current.test(transcript)) {
        r.stop();
        beginVoiceCapture();
      }
    };
    r.onerror = (event: any) => {
      wakeActiveRef.current = false;
      setWakeStatus("stopped");
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        wakeFatalErrorRef.current = true;
        setErrorMsg("Micro refusé pour le mot d'activation : autorise-le dans les réglages du navigateur.");
      } else if (event?.error === "audio-capture") {
        setErrorMsg("Micro indisponible pour le mot d'activation (probablement utilisé par une autre application) — nouvelle tentative automatique dès qu'il se libère.");
      } else if (event?.error && event.error !== "no-speech" && event.error !== "aborted") {
        setErrorMsg(`Erreur de reconnaissance vocale (mot d'activation) : ${event.error}`);
      }
    };
    r.onstart = () => {
      setWakeStatus("listening");
      wakeRetryDelayRef.current = 300;
    };
    r.onend = () => {
      wakeActiveRef.current = false;
      setWakeStatus("stopped");
      if (wakeRestartTimerRef.current !== null) {
        window.clearTimeout(wakeRestartTimerRef.current);
        wakeRestartTimerRef.current = null;
      }
      // Chrome/Edge stop continuous recognition on their own after a while
      // (and also throw "audio-capture" errors in a tight loop while the mic
      // is held by another app). Restarting `start()` synchronously right
      // here tends to wedge the recognition instance permanently in that
      // case, so we restart after a short delay instead — with backoff while
      // failures keep happening — as long as we're still supposed to be
      // scanning (unless permission was hard-denied, where retrying would
      // just loop forever).
      if (wakeWordEnabledRef.current && orbStateRef.current === "idle" && !wakeFatalErrorRef.current) {
        const delay = wakeRetryDelayRef.current;
        wakeRetryDelayRef.current = Math.min(delay * 2, 5000);
        wakeRestartTimerRef.current = window.setTimeout(() => {
          wakeRestartTimerRef.current = null;
          try {
            r.start();
            wakeActiveRef.current = true;
          } catch {
            // ignore
          }
        }, delay);
      }
    };
    wakeRecognitionRef.current = r;
    return r;
  }

  useEffect(() => {
    // Wait for explicit mic permission (via enableMic()): starting
    // SpeechRecognition before that either silently fails or pops an
    // unexpected permission prompt on page load, and never gets retried
    // once permission is actually granted since that alone doesn't re-run
    // this effect.
    if (!wakeWord.enabled || !micGranted) {
      if (wakeRestartTimerRef.current !== null) {
        window.clearTimeout(wakeRestartTimerRef.current);
        wakeRestartTimerRef.current = null;
      }
      if (wakeRecognitionRef.current) {
        wakeRecognitionRef.current.onend = null;
        wakeRecognitionRef.current.stop();
        wakeRecognitionRef.current = null;
        wakeActiveRef.current = false;
        setWakeStatus("stopped");
      }
      return;
    }

    const recognition = ensureWakeRecognition();
    if (!recognition) {
      setErrorMsg("La reconnaissance vocale n'est pas supportée par ce navigateur (essaie Chrome ou Edge).");
      return;
    }

    if (orbState === "idle" && !wakeActiveRef.current) {
      try {
        recognition.start();
        wakeActiveRef.current = true;
      } catch {
        // already started; ignore
      }
    } else if (orbState !== "idle" && wakeActiveRef.current) {
      recognition.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeWord.enabled, micGranted, orbState]);

  return {
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
  };
}
