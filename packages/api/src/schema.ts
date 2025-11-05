import { z } from "zod/v4";

export const OpenAITranscriptionModelSchema = z.enum(["fast", "accurate"]);
export const TranscriptionProviderSchema = z.enum(['openai', 'groq']);
export const TranslationLLMMPropertySchema = z.enum(['default', 'advanced', 'fast', 'ultrafast']);
