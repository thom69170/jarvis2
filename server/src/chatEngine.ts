import { generateAnthropicReply } from "./providers/anthropic.js";
import { generateGeminiReply } from "./providers/gemini.js";
import { generateOllamaReply } from "./providers/ollama.js";
import { generateOpenAiReply } from "./providers/openai.js";
import { ChatMessage, Settings } from "./types.js";

export class MissingApiKeyError extends Error {}

export async function generateReply(
  settings: Settings,
  messages: ChatMessage[],
  image?: string
): Promise<string> {
  try {
    return await generateReplyOnce(settings, messages, image);
  } catch (error) {
    // Some providers/models reject the request outright when they don't
    // support images (e.g. Ollama with a non-vision model like the default
    // llama3), instead of just ignoring the image. Retry once without it
    // rather than failing the whole exchange.
    if (image && !(error instanceof MissingApiKeyError)) {
      console.warn("Echec avec image jointe, nouvelle tentative sans image:", error);
      const fallbackSettings: Settings = {
        ...settings,
        systemPrompt: `${settings.systemPrompt}\n\n(Remarque : une image devait accompagner ce message mais n'a pas pu être transmise à ce fournisseur/modèle, qui ne gère pas les images. Si la question porte sur un visuel, dis clairement que tu ne peux pas le voir plutôt que d'inventer une description.)`,
      };
      return generateReplyOnce(fallbackSettings, messages, undefined);
    }
    throw error;
  }
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
