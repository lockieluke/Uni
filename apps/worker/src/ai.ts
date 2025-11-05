import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { OpenAITranscriptionModelSchema, TranslationLLMMPropertySchema } from "@uni/api";
import Groq from "groq-sdk";
import OpenAI from "openai";
import * as _ from 'radashi';
import { z } from "zod/v4";

export const useOpenRouter = createOpenRouter({
  baseURL: `${process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1"}`,
  apiKey: `${process.env.OPENROUTER_API_KEY}`
});

export const openai = new OpenAI();

export const translationModel: Record<z.infer<typeof TranslationLLMMPropertySchema>, string> = {
  "default": "google/gemini-2.5-flash",
  "advanced": "openai/gpt-5-mini",
  "fast": "qwen/qwen3-235b-a22b-2507"
};

const openRouterProviderObj = (provider?: string) => {
  return _.isString(provider) ? {
    openrouter: {
      provider: {
        only: [provider]
      }
    }
  } : {};
}

export const translationProvider: Record<z.infer<typeof TranslationLLMMPropertySchema>, object> = {
  "default": openRouterProviderObj("google-ai-studio"),
  "advanced": openRouterProviderObj(),
  "fast": openRouterProviderObj("cerebras")
}

export const transcriptionModel: Record<z.infer<typeof OpenAITranscriptionModelSchema>, string> = {
  "fast": "whisper-1",
  "accurate": "gpt-4o-mini-transcribe"
};

export const groq = new Groq();
