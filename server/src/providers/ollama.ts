import { ChatMessage } from "../types.js";

export async function generateOllamaReply(params: {
  baseUrl: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  messages: ChatMessage[];
  /** Base64 JPEG (no data: prefix) attached to the last message, if any — needs a vision model (llava, llama3.2-vision...). */
  image?: string;
}): Promise<string> {
  const url = `${params.baseUrl.replace(/\/$/, "")}/api/chat`;
  const lastIndex = params.messages.length - 1;
  const chatMessages = params.messages.map((m, i) => {
    if (i === lastIndex && params.image) {
      return { role: m.role, content: m.content, images: [params.image] };
    }
    return { role: m.role, content: m.content };
  });
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: params.model,
        stream: false,
        options: { temperature: params.temperature },
        messages: [{ role: "system", content: params.systemPrompt }, ...chatMessages],
      }),
    });
  } catch {
    throw new Error(
      `Impossible de joindre Ollama sur ${params.baseUrl}. Vérifie qu'il est installé et lancé (commande "ollama serve" ou l'application Ollama), ou change de fournisseur dans le panneau d'administration.`
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Ollama a répondu avec le statut ${response.status}. Vérifie que le service tourne bien sur ${params.baseUrl} et que le modèle "${params.model}" est installé (ollama pull ${params.model}). ${body}`
    );
  }

  const data = (await response.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}
