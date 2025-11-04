import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import Groq from "groq-sdk";
import OpenAI from "openai";
import * as z from "zod";

export const useOpenRouter = createOpenAICompatible({
  baseURL: `${process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1"}`,
  name: "openrouter",
  apiKey: `${process.env.OPENROUTER_API_KEY}`
});

export const openai = new OpenAI();

export const OpenAITranscriptionModelSchema = z.enum(["fast", "accurate"]);
export const TranscriptionProviderSchema = z.enum(['openai', 'groq']);
export const TranslationLLMMPropertySchema = z.enum(['default', 'advanced', 'fast']);

export const translationModel: Record<z.infer<typeof TranslationLLMMPropertySchema>, string> = {
  "default": "google/gemini-2.5-flash",
  "advanced": "openai/gpt-5-mini",
  "fast": "qwen/qwen3-235b-a22b-2507"
};

export function determineTranscriptionModel(property: z.infer<typeof OpenAITranscriptionModelSchema>) {
  if (property === 'fast')
    return "whisper-1";

  if (property === 'accurate')
    return "gpt-4o-mini-transcribe";

  return "whisper-1";
}

export const groq = new Groq();
