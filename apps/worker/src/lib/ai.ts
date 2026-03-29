import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { OpenAITranscriptionModelSchema, TranslationLLMMPropertySchema } from "@uni/api";
import Groq from "groq-sdk";
import OpenAI from "openai";
import * as _ from "radashi";
import type { z } from "zod/v4";

export const useOpenRouter = createOpenRouter({
	baseURL: `${process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1"}`,
	apiKey: `${process.env.OPENROUTER_API_KEY}`
});

export const openai = new OpenAI();

export const translationModel: Record<Exclude<z.infer<typeof TranslationLLMMPropertySchema>, "ultrafast" | "default">, string> = {
	advanced: "openai/gpt-5-mini",
	fast: "qwen/qwen3-235b-a22b-2507"
};

const openRouterProviderObj = (opts?: unknown) => {
	return _.isPlainObject(opts)
		? {
				openrouter: {
					provider: {
						...opts
					}
				}
			}
		: {};
};

export const translationProvider: Record<Exclude<z.infer<typeof TranslationLLMMPropertySchema>, "ultrafast">, object> = {
	default: openRouterProviderObj(),
	advanced: openRouterProviderObj(),
	fast: openRouterProviderObj({
		sort: "latency"
	})
};

export const specificModelOverrideProvider: Record<string, object> = {
	"google/gemini-3-flash-preview": openRouterProviderObj({
		only: "google-ai-studio"
	})
};

export const transcriptionModel: Record<z.infer<typeof OpenAITranscriptionModelSchema>, string> = {
	fast: "whisper-1",
	accurate: "gpt-4o-transcribe"
};

export const groq = new Groq();
