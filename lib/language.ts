import { fetch } from "expo/fetch";
import qs from "qs";
import * as z from "zod";
import { zu } from "zod_utilz";
import { supabase } from "./supabase";

const TranslationResponseSchema = z.object({
    pretranslatedPhrase: z.string(),
    translatedPhrase: z.string(),
    sourceLanguage: z.string(),
    targetLanguage: z.string(),
    id: z.string(),
    modelId: z.string(),
    timestamp: z.string()
});

export default async function translatePhrase(phrase: string, hints: string[]) {
    const {data: {session}, error} = await supabase.auth.getSession();
    if (error)
        throw new Error("Error getting session when translating");

    const response = await fetch(`https://uni-api.lockie.dev/translate?${qs.stringify({
        mode: "accurate"
    })}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "User-Agent": "Uni/1.0.0"
        },
        body: JSON.stringify({
            phrase,
            hints
        })
    });
    if (!response.ok)
        throw new Error("Error translating phrase");

    const payload = await response.json();
    const {success, data} = zu.SPR(await TranslationResponseSchema.safeParseAsync(payload));
    if (!success || !data)
        throw new Error("Error parsing translation response");

    if (data.pretranslatedPhrase !== phrase)
        throw new Error("Pretranslated phrase does not match original phrase");

    if (data.sourceLanguage === data.targetLanguage)
        throw new Error("Source and target languages are the same");

    if (!hints.includes(data.sourceLanguage) || !hints.includes(data.targetLanguage))
        throw new Error("Source and target languages are not in hints");

    return {
        ...data,
        timestamp: new Date(data.timestamp)
    };
}
