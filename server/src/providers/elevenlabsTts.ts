import { SpeechResult } from "../types.js";

export async function generateElevenLabsSpeech(params: {
  apiKey: string;
  voiceId: string;
  model: string;
  text: string;
}): Promise<SpeechResult> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(params.voiceId)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": params.apiKey,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: params.text,
      model_id: params.model,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ElevenLabs a répondu avec le statut ${response.status}. ${body}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType: response.headers.get("content-type") || "audio/mpeg" };
}
