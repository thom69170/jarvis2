import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ChatMessage } from "../types.js";

export async function generateOpenAiReply(params: {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  messages: ChatMessage[];
  /** Base64 JPEG (no data: prefix) attached to the last message, if any — e.g. a screenshot of the game window. */
  image?: string;
}): Promise<string> {
  const client = new OpenAI({ apiKey: params.apiKey });
  const lastIndex = params.messages.length - 1;
  const chatMessages: ChatCompletionMessageParam[] = params.messages.map((m, i) => {
    if (i === lastIndex && params.image && m.role === "user") {
      return {
        role: "user",
        content: [
          { type: "text", text: m.content },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${params.image}` } },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
  const completion = await client.chat.completions.create({
    model: params.model,
    temperature: params.temperature,
    messages: [{ role: "system", content: params.systemPrompt }, ...chatMessages],
  });
  return completion.choices[0]?.message?.content ?? "";
}
