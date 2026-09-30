import os from "node:os";
import nodemailer from "nodemailer";

/**
 * Rapports de diagnostic (crash, freeze, echecs repetes d'un fournisseur)
 * envoyes par email — entierement desactive tant que REPORT_SMTP_HOST n'est
 * pas defini dans l'environnement (voir .env.example). N'a donc aucun effet
 * sur une installation qui ne configure pas explicitement ces variables.
 */
interface ReportConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  to: string;
  from: string;
}

function loadConfig(): ReportConfig | null {
  const host = process.env.REPORT_SMTP_HOST;
  if (!host) return null;
  const user = process.env.REPORT_SMTP_USER || undefined;
  const pass = process.env.REPORT_SMTP_PASS || undefined;
  const to = process.env.REPORT_EMAIL_TO || "contact@informatiqueetsolution.fr";
  return {
    host,
    port: process.env.REPORT_SMTP_PORT ? Number(process.env.REPORT_SMTP_PORT) : 587,
    secure: process.env.REPORT_SMTP_SECURE === "true",
    user,
    pass,
    to,
    from: process.env.REPORT_EMAIL_FROM || user || to,
  };
}

// Evite de spammer si le meme probleme se repete en boucle (ex: Ollama down
// pendant une heure) : un seul email par "kind" toutes les 30 minutes.
const COOLDOWN_MS = 30 * 60 * 1000;
const lastSentAt = new Map<string, number>();

export async function reportProblem(kind: string, details: string): Promise<void> {
  const config = loadConfig();
  if (!config) return;

  const now = Date.now();
  const last = lastSentAt.get(kind) ?? 0;
  if (now - last < COOLDOWN_MS) return;
  lastSentAt.set(kind, now);

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
    await transporter.sendMail({
      from: config.from,
      to: config.to,
      subject: `[Jarvis] ${kind} — ${os.hostname()}`,
      text: `${details}\n\n--\nMachine : ${os.hostname()}\nHeure : ${new Date().toISOString()}`,
    });
  } catch (error) {
    console.error("Échec de l'envoi du rapport de diagnostic par email :", error);
  }
}

// Suivi des echecs consecutifs par fournisseur (LLM ou TTS) — alerte au bout
// de FAILURE_THRESHOLD echecs d'affilee, puis se reinitialise (le cooldown
// ci-dessus prend ensuite le relais pour eviter les alertes en rafale).
const FAILURE_THRESHOLD = 3;
const consecutiveFailures = new Map<string, number>();

export function noteProviderResult(kind: string, ok: boolean, detail?: string): void {
  if (ok) {
    consecutiveFailures.delete(kind);
    return;
  }
  const count = (consecutiveFailures.get(kind) ?? 0) + 1;
  consecutiveFailures.set(kind, count);
  if (count >= FAILURE_THRESHOLD) {
    consecutiveFailures.set(kind, 0);
    reportProblem(`Échecs répétés — ${kind}`, detail ?? "Aucun detail disponible.").catch(() => undefined);
  }
}
