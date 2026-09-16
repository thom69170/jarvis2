import { useSearchParams } from "react-router-dom";
import { Orb } from "../components/Orb";
import { useJarvis } from "../hooks/useJarvis";

/**
 * Visual-only view of Jarvis — no input box, no buttons, no chat log, just
 * the avatar reacting live. Fully self-sufficient (same useJarvis() hook as
 * /jarvis: mic, push-to-talk relay, wake word all work here too), meant to
 * be the ONE window you open as an OBS browser source during a stream.
 *
 * Don't run this alongside /jarvis at the same time if push-to-talk or the
 * wake word is enabled — each open tab runs its own independent listener,
 * so both would react to the same trigger and you'd get Jarvis answering
 * (and speaking) twice. Use /jarvis for typing/testing/tweaking settings
 * when you're not live, and this page once you are.
 *
 * Add ?transparent=1 for a transparent background, and ?size=NNN to resize
 * the avatar (default 260px).
 */
export default function Overlay() {
  const [params] = useSearchParams();
  const transparent = params.get("transparent") === "1";
  const size = Number(params.get("size")) || 260;

  const { orbState, screenShared, shareScreen } = useJarvis("overlay");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: transparent ? "transparent" : "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <Orb state={orbState} size={size} />

      {/* Only shown until clicked once — this is the one control this page
          allows itself, since sharing the game window needs a user gesture
          and can't be triggered from /jarvis in a different tab. */}
      {!screenShared && (
        <button
          onClick={shareScreen}
          title="Partager la fenêtre du jeu avec Jarvis"
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            background: "transparent",
            color: "var(--text-dim)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 11,
            opacity: 0.5,
          }}
        >
          🎮
        </button>
      )}
    </div>
  );
}
