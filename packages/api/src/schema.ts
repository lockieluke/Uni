import { z } from "zod/v4";

export const OpenAITranscriptionModelSchema = z.enum(["fast", "accurate"]);
export const TranscriptionProviderSchema = z.enum([
	"openai",
	"openai-realtime",
	"groq",
]);
export const TranslationLLMMPropertySchema = z.enum([
	"default",
	"advanced",
	"fast",
	"ultrafast",
]);

export const LanguageSchema = z.object({
	displayName: z.record(z.string(), z.string()),
	flag: z.string().nullish(),
	customPrompt: z.string().nullish(),
	disclaimer: z.string(),
});

export type TLanguageSchema = z.infer<typeof LanguageSchema>;
