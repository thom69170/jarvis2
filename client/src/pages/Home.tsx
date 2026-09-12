import { Link } from "react-router-dom";

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    padding: 24,
    textAlign: "center",
  },
  title: {
    fontSize: 42,
    letterSpacing: 6,
    margin: 0,
    color: "var(--cyan)",
    textShadow: "0 0 24px var(--cyan-dim)",
  },
  subtitle: {
    color: "var(--text-dim)",
    margin: 0,
    maxWidth: 480,
  },
  cards: {
    display: "flex",
    gap: 20,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 16,
  },
  card: {
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "24px 28px",
    width: 220,
    textDecoration: "none",
    color: "var(--text)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    transition: "border-color 0.15s, transform 0.15s",
  },
  cardTitle: {
    color: "var(--cyan)",
    fontSize: 18,
    margin: 0,
  },
  cardDesc: {
    color: "var(--text-dim)",
    fontSize: 13,
    margin: 0,
  },
};

export default function Home() {
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>J.A.R.V.I.S</h1>
      <p style={styles.subtitle}>
        Assistant IA pour animer tes lives Twitch. Configure-le dans le panneau
        d'administration, puis ouvre la fenêtre Jarvis en tant que source
        (OBS / navigateur) pour l'afficher à l'écran.
      </p>
      <div style={styles.cards}>
        <Link to="/admin" style={styles.card}>
          <p style={styles.cardTitle}>⚙ Administration</p>
          <p style={styles.cardDesc}>
            Clés API, choix du modèle, Ollama en local, température de
            réponse, personnalité.
          </p>
        </Link>
        <Link to="/jarvis" style={styles.card}>
          <p style={styles.cardTitle}>◎ Fenêtre Jarvis</p>
          <p style={styles.cardDesc}>
            Vue complète : saisie texte, historique, réglages voix. Pour
            tester et régler Jarvis hors live.
          </p>
        </Link>
        <Link to="/overlay" style={styles.card}>
          <p style={styles.cardTitle}>◉ Vue OBS (visuel seul)</p>
          <p style={styles.cardDesc}>
            Juste l'avatar de Jarvis, rien d'autre. La fenêtre à ajouter
            comme source dans OBS pendant le live.
          </p>
        </Link>
      </div>
    </div>
  );
}
