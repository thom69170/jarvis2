import OpenAI from "openai";
import { SpeechResult } from "../types.js";

export async function generateOpenAiSpeech(params: {
  apiKey: string;
  voice: string;
  text: string;
}): Promise<SpeechResult> {
  const client = new OpenAI({ apiKey: params.apiKey });
  const response = await client.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: params.voice as OpenAI.Audio.Speech.SpeechCreateParams["voice"],
    input: params.text,
  });
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType: response.headers.get("content-type") || "audio/mpeg" };
}
