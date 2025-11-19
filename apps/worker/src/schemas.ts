import { z } from "zod/v4";

export const TranslationSchema = z.object({
  phrase: z.string(),
  hints: z.array(z.string())
});
