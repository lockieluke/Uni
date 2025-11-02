import { z } from "zod";

export const translateSchema = z.object({
  phrase: z.string(),
  hints: z.array(z.string())
});

export const LanguageSchema = z.object({
  displayName: z.record(z.string(), z.string()),
  flag: z.string().nullish(),
  customPrompt: z.string().nullish(),
  disclaimer: z.string()
});
