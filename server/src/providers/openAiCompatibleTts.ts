import { SpeechResult } from "../types.js";

/**
 * Client for any self-hosted TTS server that speaks the same
 * POST {baseUrl}/audio/speech -> audio bytes shape as OpenAI's API.
 * Kokoro-FastAPI and piper-openai-tts implement this natively; our own
 * bark server script (tools/bark-server) mimics it too, so all three
 * local engines share this one client.
 */
export async function generateOpenAiCompatibleSpeech(params: {
  baseUrl: string;
  voice: string;
  text: string;
  serviceLabel: string;
}): Promise<SpeechResult> {
  const url = `${params.baseUrl.replace(/\/$/, "")}/audio/speech`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: params.serviceLabel.toLowerCase(),
        voice: params.voice,
        input: params.text,
      }),
    });
  } catch {
    throw new Error(
      `Impossible de joindre le serveur ${params.serviceLabel} sur ${params.baseUrl}. Vérifie qu'il est bien installé et lancé, ou change de voix dans le panneau d'administration.`
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${params.serviceLabel} a répondu avec le statut ${response.status}. ${body}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType: response.headers.get("content-type") || "audio/mpeg" };
}
