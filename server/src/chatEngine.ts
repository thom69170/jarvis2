import { addMemory, loadMemories } from "./memoryStore.js";
import { generateAnthropicReply } from "./providers/anthropic.js";
import { generateGeminiReply } from "./providers/gemini.js";
import { generateOllamaReply } from "./providers/ollama.js";
import { generateOpenAiReply } from "./providers/openai.js";
import { ChatMessage, Moderator, Settings } from "./types.js";

export class MissingApiKeyError extends Error {}

/**
 * Format few-shot : un petit modele local (teste sur Ollama/llama3) suit
 * bien mieux cette forme ("complete le motif") qu'une instruction abstraite
 * dans un system prompt seul, qui produisait soit une sortie vide, soit des
 * faux positifs (ex: prendre "raconte une blague" pour un fait a retenir).
 */
function buildMemoryExtractionPrompt(userText: string, assistantText: string): string {
  return `Exemple 1:
Streamer: je joue a Zelda en ce moment
Réponse: Joue actuellement à Zelda

Exemple 2:
Streamer: c'est quoi la capitale de la France ?
Réponse: NON

Exemple 3:
Streamer: je m'appelle Thomas et mon chat s'appelle Mistigri
Réponse: S'appelle Thomas, a un chat nommé Mistigri

Exemple 4:
Streamer: raconte moi une blague
Réponse: NON

Exemple 5:
Streamer: peux-tu m'aider à vaincre ce boss ?
Réponse: NON

Maintenant à toi. Voici ce que le streamer vient de dire à Jarvis, et sa réponse :
Streamer: ${userText}
Jarvis: ${assistantText}

Le streamer a-t-il partagé un fait NOUVEAU et durable sur lui-même ou son stream (son jeu du moment, une préférence, un détail personnel, une blague récurrente) ? En suivant le format des exemples ci-dessus, réponds UNIQUEMENT par ce fait résumé en une courte phrase neutre à la troisième personne, ou UNIQUEMENT par NON si ce n'est pas le cas.`;
}

/** Ce que Jarvis sait déjà, à injecter dans le prompt système de la réponse principale. */
function buildMemoryRecallBlock(): string {
  const memories = loadMemories();
  if (!memories.length) return "";
  return `\n\nVoici ce que tu sais déjà sur le streamer et le stream (utilise-le naturellement si c'est pertinent, ne le récite pas comme une liste) :\n${memories
    .map((m) => `- ${m.text}`)
    .join("\n")}`;
}

/** Liste des modérateurs de la chaîne (saisie manuellement dans l'admin) pour que Jarvis les reconnaisse par leur nom. */
function buildModeratorsBlock(moderators: Moderator[]): string {
  if (!moderators.length) return "";
  return `\n\nVoici les modérateurs de la chaîne (si le streamer ou le chat mentionne un de ces noms, tu sais que c'est un·e modérateur·rice — tu peux le souligner avec complicité si pertinent) :\n${moderators
    .map((m) => `- ${m.name}${m.note ? ` (${m.note})` : ""}`)
    .join("\n")}`;
}

/**
 * Appel IA separe et non bloquant (ne retarde jamais la reponse principale)
 * pour decider si le dernier echange contient un fait a retenir sur le long
 * terme. Une tache unique et simple pour un petit modele local a suivre,
 * plutot que de lui demander en plus de formater une ligne speciale au
 * milieu d'une reponse "dans le personnage" — teste peu fiable sur Ollama.
 */
/** Prend la derniere ligne non vide (certains modeles ajoutent une phrase d'intro malgre la consigne) et retire un eventuel prefixe "Réponse :". */
function parseExtractionResult(raw: string): string | null {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const lastLine = lines[lines.length - 1] ?? "";
  const cleaned = lastLine
    .replace(/^r[ée]ponse\s*:\s*/i, "")
    .replace(/^["'\s]+|["'\s.]+$/g, "");
  if (!cleaned || /^non$/i.test(cleaned)) return null;
  return cleaned;
}

async function extractAndStoreMemory(settings: Settings, userText: string, assistantText: string): Promise<void> {
  try {
    const extractionSettings: Settings = {
      ...settings,
      systemPrompt: "Tu réponds de façon concise, en suivant exactement le format demandé.",
      temperature: 0.2,
    };
    const result = await generateReplyOnce(
      extractionSettings,
      [{ role: "user", content: buildMemoryExtractionPrompt(userText, assistantText) }],
      undefined
    );
    const fact = parseExtractionResult(result);
    if (!fact) return;
    const saved = addMemory(fact);
    if (saved) console.log(`[mémoire] Nouveau souvenir : ${saved.text}`);
  } catch (error) {
    console.warn("Échec de l'extraction de mémoire (non bloquant):", error);
  }
}

export async function generateReply(
  settings: Settings,
  messages: ChatMessage[],
  image?: string
): Promise<string> {
  const augmentedSettings: Settings = {
    ...settings,
    systemPrompt: `${settings.systemPrompt}${buildMemoryRecallBlock()}${buildModeratorsBlock(settings.moderators)}`,
  };

  let reply: string;
  try {
    reply = await generateReplyOnce(augmentedSettings, messages, image);
  } catch (error) {
    // Some providers/models reject the request outright when they don't
    // support images (e.g. Ollama with a non-vision model like the default
    // llama3), instead of just ignoring the image. Retry once without it
    // rather than failing the whole exchange.
    if (image && !(error instanceof MissingApiKeyError)) {
      console.warn("Echec avec image jointe, nouvelle tentative sans image:", error);
      const fallbackSettings: Settings = {
        ...augmentedSettings,
        systemPrompt: `${augmentedSettings.systemPrompt}\n\n(Remarque : une image devait accompagner ce message mais n'a pas pu être transmise à ce fournisseur/modèle, qui ne gère pas les images. Si la question porte sur un visuel, dis clairement que tu ne peux pas le voir plutôt que d'inventer une description.)`,
      };
      reply = await generateReplyOnce(fallbackSettings, messages, undefined);
    } else {
      throw error;
    }
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    // Fire-and-forget : ne doit jamais retarder ni casser la reponse principale.
    extractAndStoreMemory(settings, lastUserMessage.content, reply).catch(() => undefined);
  }

  return reply;
}

async function generateReplyOnce(settings: Settings, messages: ChatMessage[], image?: string): Promise<string> {
  const { provider, temperature, systemPrompt } = settings;

  switch (provider) {
    case "openai": {
      if (!settings.apiKeys.openai) {
        throw new MissingApiKeyError("Aucune clé API OpenAI n'est configurée dans le panneau d'administration.");
      }
      // OpenAI's chat.completions temperature ranges 0-2.
      return generateOpenAiReply({
        apiKey: settings.apiKeys.openai,
        model: settings.models.openai,
        temperature: temperature * 2,
        systemPrompt,
        messages,
        image,
      });
    }
    case "anthropic": {
      if (!settings.apiKeys.anthropic) {
        throw new MissingApiKeyError("Aucune clé API Anthropic (Claude) n'est configurée dans le panneau d'administration.");
      }
      // Anthropic's temperature ranges 0-1.
      return generateAnthropicReply({
        apiKey: settings.apiKeys.anthropic,
        model: settings.models.anthropic,
        temperature,
        systemPrompt,
        messages,
        image,
      });
    }
    case "gemini": {
      if (!settings.apiKeys.gemini) {
        throw new MissingApiKeyError("Aucune clé API Google Gemini n'est configurée dans le panneau d'administration.");
      }
      // Gemini's temperature ranges 0-2.
      return generateGeminiReply({
        apiKey: settings.apiKeys.gemini,
        model: settings.models.gemini,
        temperature: temperature * 2,
        systemPrompt,
        messages,
        image,
      });
    }
    case "ollama": {
      // Use the dedicated vision model only when an image is actually attached,
      // so day-to-day text chat keeps using the lighter/faster text model.
      const model = image && settings.ollama.visionModel ? settings.ollama.visionModel : settings.ollama.model;
      return generateOllamaReply({
        baseUrl: settings.ollama.baseUrl,
        model,
        temperature: temperature * 2,
        systemPrompt,
        messages,
        image,
      });
    }
    default:
      throw new Error(`Fournisseur inconnu: ${provider}`);
  }
}
