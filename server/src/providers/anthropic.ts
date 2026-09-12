import Anthropic from "@anthropic-ai/sdk";
import { ChatMessage } from "../types.js";

export async function generateAnthropicReply(params: {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  messages: ChatMessage[];
  /** Base64 JPEG (no data: prefix) attached to the last message, if any — e.g. a screenshot of the game window. */
  image?: string;
}): Promise<string> {
  const client = new Anthropic({ apiKey: params.apiKey });
  const lastIndex = params.messages.length - 1;
  const chatMessages = params.messages.map((m, i) => {
    if (i === lastIndex && params.image) {
      return {
        role: m.role,
        content: [
          { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: params.image } },
          { type: "text" as const, text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
  const response = await client.messages.create({
    model: params.model,
    max_tokens: 1024,
    temperature: params.temperature,
    system: params.systemPrompt,
    messages: chatMessages,
  });
  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text : "";
}
