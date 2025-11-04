import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import Groq from "groq-sdk";
import OpenAI from "openai";
import * as z from "zod";

export const useOpenRouter = createOpenRouter({
  baseURL: `${process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1"}`
});

export const openai = new OpenAI();

export const OpenAITranscriptionModelSchema = z.enum(["fast", "accurate"]);
export const TranscriptionProviderSchema = z.enum(['openai', 'groq']);
export const TranslationLLMMPropertySchema = z.enum(['default', 'advanced']);

export function determineTranslationLLM(property: z.infer<typeof TranslationLLMMPropertySchema>) {
  if (property === 'default')
    return "google/gemini-2.5-flash";

  if (property === "advanced")
    return "openai/gpt-5-mini";

  return "google/gemini-2.5-flash";
}

export function determineTranscriptionModel(property: z.infer<typeof OpenAITranscriptionModelSchema>) {
  if (property === 'fast')
    return "whisper-1";

  if (property === 'accurate')
    return "gpt-4o-mini-transcribe";

  return "whisper-1";
}

export const groq = new Groq();
