export type OrbState = "idle" | "thinking" | "speaking" | "listening" | "error";

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
    color: "var(--cyan)",
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
    color: "var(--cyan)",
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
export function Orb({ state, size = 260 }: { state: OrbState; size?: number }) {
  const face = FACE_STATES[state];
  const screenW = size * 0.86;
  const screenH = screenW * 0.82;
  const eyeW = screenW * 0.24;
  const eyeH = screenH * 0.1 * face.eyeHeightScale;
  const mouthW = screenW * 0.34 * face.mouthWidthScale;
  const mouthH = screenH * 0.14 * face.mouthHeightScale;

  return (
    <div
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
            <div style={{ display: "flex", gap: screenW * 0.08 }}>
              <div
                className={face.blink ? "jarvis-blink" : undefined}
                style={{
                  width: eyeW,
                  height: eyeH,
                  borderRadius: eyeH / 2,
                  background: face.color,
                  boxShadow: `0 0 12px ${face.color}, 0 0 30px ${face.color}, 0 0 60px ${face.color}66`,
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
                  boxShadow: `0 0 12px ${face.color}, 0 0 30px ${face.color}, 0 0 60px ${face.color}66`,
                  transform: `rotate(${face.eyeTilt}deg)`,
                  transition: "all 0.25s ease",
                }}
              />
            </div>
            <div
              className={face.talk ? "jarvis-talk" : undefined}
              style={{
                width: mouthW,
                height: mouthH,
                borderRadius: face.mouthRadius,
                background: face.color,
                boxShadow: `0 0 12px ${face.color}, 0 0 30px ${face.color}, 0 0 50px ${face.color}55`,
                transition: "all 0.25s ease",
              }}
            />
          </div>
        </div>

        {/* Power LED */}
        <div
          style={{
            position: "absolute",
            bottom: size * 0.02,
            right: size * 0.09,
            width: size * 0.02,
            height: size * 0.02,
            borderRadius: "50%",
            background: face.color,
            boxShadow: `0 0 6px ${face.color}, 0 0 12px ${face.color}`,
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
      `}</style>
    </div>
  );
}
