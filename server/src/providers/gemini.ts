import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage } from "../types.js";

export async function generateGeminiReply(params: {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  messages: ChatMessage[];
  /** Base64 JPEG (no data: prefix) attached to the last message, if any — e.g. a screenshot of the game window. */
  image?: string;
}): Promise<string> {
  const genAI = new GoogleGenerativeAI(params.apiKey);
  const model = genAI.getGenerativeModel({
    model: params.model,
    systemInstruction: params.systemPrompt,
  });

  const history = params.messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const lastMessage = params.messages[params.messages.length - 1];

  const chat = model.startChat({
    history,
    generationConfig: { temperature: params.temperature },
  });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: lastMessage?.content ?? "" },
  ];
  if (params.image) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: params.image } });
  }
  const result = await chat.sendMessage(parts);
  return result.response.text();
}
