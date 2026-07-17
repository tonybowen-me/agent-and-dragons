import OpenAI from "openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function isLlmEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

function model(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

export async function chatText(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: model(),
    messages,
    temperature: opts.temperature ?? 0.9,
    max_tokens: opts.maxTokens ?? 700,
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

export async function chatJSON<T>(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<T> {
  const res = await getClient().chat.completions.create({
    model: model(),
    messages,
    temperature: opts.temperature ?? 0.8,
    max_tokens: opts.maxTokens ?? 700,
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content?.trim() ?? "{}";
  return JSON.parse(raw) as T;
}
