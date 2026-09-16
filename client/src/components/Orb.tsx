import { useEffect, useRef } from "react";

export type OrbState = "idle" | "thinking" | "speaking" | "listening" | "error";

const JARVIS_COLOR = "#450046";

interface FaceConfig {
  color: string;
  eyeTilt: number; // degrees; mirrored on the other eye
  eyeHeightScale: number;
  mouthWidthScale: number;
  mouthHeightScale: number;
  mouthRadius: string;
  blink: boolean;
  talk: boolean;
  glitch: boolean;
}

const FACE_STATES: Record<OrbState, FaceConfig> = {
  idle: {
    color: JARVIS_COLOR,
    eyeTilt: 6,
    eyeHeightScale: 1,
    mouthWidthScale: 1,
    mouthHeightScale: 1,
    mouthRadius: "8px 8px 46px 46px / 8px 8px 34px 34px",
    blink: true,
    talk: false,
    glitch: false,
  },
  listening: {
    color: "var(--ok)",
    eyeTilt: 0,
    eyeHeightScale: 1.25,
    mouthWidthScale: 0.45,
    mouthHeightScale: 1.4,
    mouthRadius: "50%",
    blink: false,
    talk: false,
    glitch: false,
  },
  thinking: {
    color: "#f5c542",
    eyeTilt: 16,
    eyeHeightScale: 0.8,
    mouthWidthScale: 0.55,
    mouthHeightScale: 0.35,
    mouthRadius: "6px",
    blink: false,
    talk: false,
    glitch: false,
  },
  speaking: {
    color: JARVIS_COLOR,
    eyeTilt: 4,
    eyeHeightScale: 1,
    mouthWidthScale: 0.9,
    mouthHeightScale: 1,
    mouthRadius: "10px 10px 40px 40px / 10px 10px 30px 30px",
    blink: false,
    talk: true,
    glitch: false,
  },
  error: {
    color: "var(--danger)",
    eyeTilt: -18,
    eyeHeightScale: 0.85,
    mouthWidthScale: 0.6,
    mouthHeightScale: 0.3,
    mouthRadius: "6px",
    blink: false,
    talk: false,
    glitch: true,
  },
};

/**
 * Jarvis's visual avatar: a retro CRT television whose screen shows a
 * minimal glowing face. Expression + color communicate state on their own
 * (no text), driven entirely by FACE_STATES above.
 */
function glow(color: string) {
  return `0 0 16px ${color}, 0 0 36px ${color}, 0 0 70px ${color}, 0 0 110px ${color}99`;
}

export function Orb({
  state,
  size = 260,
  mouthLevelRef,
}: {
  state: OrbState;
  size?: number;
  /** Niveau audio courant (0..1), mis a jour en dehors de React (voir useJarvis.ts) — quand fourni pendant "speaking", pilote l'ouverture de la bouche image par image au lieu de l'animation generique a vitesse fixe. */
  mouthLevelRef?: React.RefObject<number>;
}) {
  const face = FACE_STATES[state];
  const idle = state === "idle";
  const screenW = size * 0.86;
  const screenH = screenW * 0.82;
  const eyeW = screenW * 0.24;
  const eyeH = screenH * 0.1 * face.eyeHeightScale;
  const mouthW = screenW * 0.34 * face.mouthWidthScale;
  const mouthH = screenH * 0.14 * face.mouthHeightScale;

  const mouthRef = useRef<HTMLDivElement | null>(null);
  const liveSync = state === "speaking" && !!mouthLevelRef;

  useEffect(() => {
    if (!liveSync || !mouthLevelRef) return;
    let raf: number;
    let smoothed = 0;
    const closedH = mouthH * 0.35;
    const openH = mouthH * 1.35;
    const tick = () => {
      const target = mouthLevelRef.current ?? 0;
      smoothed += (target - smoothed) * 0.4;
      if (mouthRef.current) {
        mouthRef.current.style.height = `${closedH + (openH - closedH) * smoothed}px`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [liveSync, mouthLevelRef, mouthH]);

  return (
    <div
      className={idle ? "jarvis-idle-bob" : undefined}
      style={{
        width: size,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Antenna */}
      <svg
        width={size * 0.5}
        height={size * 0.22}
        viewBox="0 0 100 44"
        className={idle ? "jarvis-idle-antenna" : undefined}
        style={{ marginBottom: -size * 0.03 }}
      >
        <line x1="50" y1="44" x2="20" y2="2" stroke="#4a4a52" strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="44" x2="80" y2="2" stroke="#4a4a52" strokeWidth="3" strokeLinecap="round" />
        <circle cx="20" cy="2" r="4" fill="#5a5a63" />
        <circle cx="80" cy="2" r="4" fill="#5a5a63" />
      </svg>

      {/* TV body */}
      <div
        style={{
          width: size,
          padding: size * 0.07,
          borderRadius: size * 0.12,
          background: "linear-gradient(160deg, #4a4a52 0%, #2b2b31 45%, #18181c 100%)",
          boxShadow: `inset 0 2px 0 rgba(255,255,255,0.08), inset 0 -6px 14px rgba(0,0,0,0.5), 0 18px 40px rgba(0,0,0,0.55)`,
          position: "relative",
        }}
      >
        {/* Screen */}
        <div
          style={{
            width: screenW,
            height: screenH,
            borderRadius: size * 0.08,
            background: "radial-gradient(120% 120% at 30% 20%, #0c1210 0%, #050706 60%, #020302 100%)",
            boxShadow: "inset 0 0 30px rgba(0,0,0,0.9), inset 0 0 3px rgba(0,0,0,1)",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "jarvis-crt-flicker 6s ease-in-out infinite",
          }}
          className={face.glitch ? "jarvis-face-glitch" : undefined}
        >
          {/* Scanlines */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 2px, transparent 4px)",
              pointerEvents: "none",
              mixBlendMode: "multiply",
            }}
          />
          {/* Vignette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              boxShadow: "inset 0 0 40px 10px rgba(0,0,0,0.85)",
              pointerEvents: "none",
            }}
          />

          {/* Face */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: screenH * 0.1 }}>
            <div className={idle ? "jarvis-idle-look" : undefined} style={{ display: "flex", gap: screenW * 0.08 }}>
              <div
                className={face.blink ? "jarvis-blink" : undefined}
                style={{
                  width: eyeW,
                  height: eyeH,
                  borderRadius: eyeH / 2,
                  background: face.color,
                  boxShadow: glow(face.color),
                  filter: "brightness(1.6) saturate(1.3)",
                  transform: `rotate(${-face.eyeTilt}deg)`,
                  transition: "all 0.25s ease",
                }}
              />
              <div
                className={face.blink ? "jarvis-blink" : undefined}
                style={{
                  width: eyeW,
                  height: eyeH,
                  borderRadius: eyeH / 2,
                  background: face.color,
                  boxShadow: glow(face.color),
                  filter: "brightness(1.6) saturate(1.3)",
                  transform: `rotate(${face.eyeTilt}deg)`,
                  transition: "all 0.25s ease",
                }}
              />
            </div>
            <div
              ref={mouthRef}
              data-jarvis-mouth="true"
              className={!liveSync && face.talk ? "jarvis-talk" : idle ? "jarvis-idle-mouth" : undefined}
              style={{
                width: mouthW,
                height: mouthH,
                borderRadius: face.mouthRadius,
                background: face.color,
                boxShadow: glow(face.color),
                filter: "brightness(1.6) saturate(1.3)",
                // Pas de transition en suivi audio en direct : elle lisserait/retarderait
                // les mises a jour a 60 im/s et donnerait un mouvement mou plutot que net.
                transition: liveSync ? "none" : "all 0.25s ease",
              }}
            />
          </div>
        </div>

        {/* Power LED */}
        <div
          className={idle ? "jarvis-idle-led" : undefined}
          style={{
            position: "absolute",
            bottom: size * 0.02,
            right: size * 0.09,
            width: size * 0.02,
            height: size * 0.02,
            borderRadius: "50%",
            background: face.color,
            filter: "brightness(1.6) saturate(1.3)",
            boxShadow: `0 0 8px ${face.color}, 0 0 18px ${face.color}, 0 0 30px ${face.color}99`,
          }}
        />
      </div>

      {/* Feet */}
      <div style={{ display: "flex", gap: size * 0.5, marginTop: -2 }}>
        <div style={{ width: size * 0.08, height: size * 0.03, background: "#26262b", borderRadius: 3 }} />
        <div style={{ width: size * 0.08, height: size * 0.03, background: "#26262b", borderRadius: 3 }} />
      </div>

      <style>{`
        @keyframes jarvis-crt-flicker {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.04); }
          52% { filter: brightness(0.97); }
        }
        @keyframes jarvis-blink-kf {
          0%, 92%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.1); }
        }
        .jarvis-blink {
          animation: jarvis-blink-kf 4.5s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes jarvis-talk-kf {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1.3); }
        }
        .jarvis-talk {
          animation: jarvis-talk-kf 0.22s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes jarvis-face-glitch-kf {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-2px, 1px); }
          40% { transform: translate(2px, -1px); }
          60% { transform: translate(-1px, 0); }
          80% { transform: translate(1px, 1px); }
        }
        .jarvis-face-glitch {
          animation: jarvis-crt-flicker 6s ease-in-out infinite, jarvis-face-glitch-kf 0.4s steps(2) infinite;
        }
        @keyframes jarvis-idle-bob-kf {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .jarvis-idle-bob {
          animation: jarvis-idle-bob-kf 4s ease-in-out infinite;
        }
        @keyframes jarvis-idle-antenna-kf {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg); }
          75% { transform: rotate(3deg); }
        }
        .jarvis-idle-antenna {
          animation: jarvis-idle-antenna-kf 4s ease-in-out infinite;
          transform-origin: 50% 100%;
        }
        @keyframes jarvis-idle-look-kf {
          0%, 15% { transform: translateX(0); }
          22%, 32% { transform: translateX(-6px); }
          40%, 58% { transform: translateX(0); }
          65%, 75% { transform: translateX(6px); }
          83%, 100% { transform: translateX(0); }
        }
        .jarvis-idle-look {
          animation: jarvis-idle-look-kf 9s ease-in-out infinite;
        }
        @keyframes jarvis-idle-mouth-kf {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04, 0.85); }
        }
        .jarvis-idle-mouth {
          animation: jarvis-idle-mouth-kf 3.2s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes jarvis-idle-led-kf {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .jarvis-idle-led {
          animation: jarvis-idle-led-kf 2.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
