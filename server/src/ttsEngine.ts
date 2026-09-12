import { generateElevenLabsSpeech } from "./providers/elevenlabsTts.js";
import { generateOpenAiCompatibleSpeech } from "./providers/openAiCompatibleTts.js";
import { generateOpenAiSpeech } from "./providers/openaiTts.js";
import { Settings, SpeechResult } from "./types.js";

export class MissingTtsConfigError extends Error {}

export async function generateSpeech(settings: Settings, text: string): Promise<SpeechResult> {
  const { tts } = settings;

  switch (tts.provider) {
    case "elevenlabs": {
      if (!settings.apiKeys.elevenlabs) {
        throw new MissingTtsConfigError(
          "Aucune clé API ElevenLabs n'est configurée dans le panneau d'administration."
        );
      }
      if (!tts.elevenlabs.voiceId) {
        throw new MissingTtsConfigError(
          "Aucun identifiant de voix ElevenLabs n'est configuré dans le panneau d'administration."
        );
      }
      return generateElevenLabsSpeech({
        apiKey: settings.apiKeys.elevenlabs,
        voiceId: tts.elevenlabs.voiceId,
        model: tts.elevenlabs.model,
        text,
      });
    }
    case "openai": {
      if (!settings.apiKeys.openai) {
        throw new MissingTtsConfigError(
          "Aucune clé API OpenAI n'est configurée dans le panneau d'administration."
        );
      }
      return generateOpenAiSpeech({
        apiKey: settings.apiKeys.openai,
        voice: tts.openai.voice,
        text,
      });
    }
    case "kokoro": {
      return generateOpenAiCompatibleSpeech({
        baseUrl: tts.kokoro.baseUrl,
        voice: tts.kokoro.voice,
        serviceLabel: "Kokoro",
        text,
      });
    }
    case "piper": {
      return generateOpenAiCompatibleSpeech({
        baseUrl: tts.piper.baseUrl,
        voice: tts.piper.voice,
        serviceLabel: "Piper",
        text,
      });
    }
    case "bark": {
      return generateOpenAiCompatibleSpeech({
        baseUrl: tts.bark.baseUrl,
        voice: tts.bark.voice,
        serviceLabel: "Bark",
        text,
      });
    }
    case "browser":
    default:
      throw new MissingTtsConfigError("La voix du navigateur ne passe pas par le serveur.");
  }
}
