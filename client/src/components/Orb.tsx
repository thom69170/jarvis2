export type OrbState = "idle" | "thinking" | "speaking" | "listening" | "error";

const ORB_COLORS: Record<OrbState, string> = {
  idle: "var(--cyan)",
  thinking: "#f5c542",
  speaking: "var(--cyan)",
  listening: "var(--ok)",
  error: "var(--danger)",
};

export function Orb({ state, size = 180 }: { state: OrbState; size?: number }) {
  const color = ORB_COLORS[state];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          opacity: 0.5,
          animation: state === "idle" ? "jarvis-pulse 3s ease-in-out infinite" : "jarvis-pulse-fast 0.9s ease-in-out infinite",
        }}
      />
      <div
        style={{
          width: "70%",
          height: "70%",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
          border: `2px solid ${color}`,
          boxShadow: `0 0 40px ${color}88`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          fontSize: 13,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {state === "idle" && "Jarvis"}
        {state === "thinking" && "…"}
        {state === "speaking" && "◉"}
        {state === "listening" && "🎙"}
        {state === "error" && "!"}
      </div>
      <style>{`
        @keyframes jarvis-pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
        @keyframes jarvis-pulse-fast {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.3); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
