import { Language } from "@/constants/Language";
import { decode, encode } from "@msgpack/msgpack";
import { getLocales } from "expo-localization";
import { fetch } from "expo/fetch";
import qs from "qs";
import * as _ from "radashi";
import * as z from "zod/v4";
import { mmkvStorage } from "./storage";
import { supabase } from "./supabase";

const TranslationResponseSchema = z.object({
    pretranslatedPhrase: z.string(),
    translatedPhrase: z.string(),
    sourceLanguage: z.string(),
    targetLanguage: z.string(),
    id: z.string(),
    modelId: z.string(),
    timestamp: z.date()
});

export async function getLanguages(hostLang: string = getLocales()[0].languageCode ?? "en-GB"): Promise<{ [key: string]: Language; }> {
    const disableCache = (await mmkvStorage.getBoolAsync("disableCache")) ?? false;

    const {data: {session}, error} = await supabase.auth.getSession();
    if (error)
        throw new Error("Error getting session when translating");

    const response = await fetch("https://uni-api.lockie.dev/languages", {
        headers: {
            "Authorization": `Bearer ${session?.access_token}`,
            "User-Agent": "Uni/1.0.0",
            ...disableCache ? {
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "Expires": "0"
            } : {}
        }
    });
    const payload = decode(await response.arrayBuffer());
    if (!response.ok)
        throw new Error(`Error getting languages: ${_.get(payload, "error.message", "Unknown error")}`);

    const languages = _.get(payload, "languages", {});

    return {
        ..._.mapValues(languages, (language, key) => ({
            ..._.isPlainObject(language) ? language : {},
            displayName: _.get(language, `displayName.${hostLang}`, _.get(language, "displayName.en-GB")),
            code: key
        }))
    };
}

export default async function translatePhrase(phrase: string, hints: string[], model: string = "accurate") {
    const {data: {session}, error} = await supabase.auth.getSession();
    if (error)
        throw new Error("Error getting session when translating");

    const response = await fetch(`https://uni-api.lockie.dev/translate?${qs.stringify({
        mode: model
    })}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-msgpack",
            "Authorization": `Bearer ${session?.access_token}`,
            "User-Agent": "Uni/1.0.0"
        },
        body: encode({
            phrase,
            hints
        })
    });
    const payload = decode(await response.arrayBuffer());
    if (!response.ok)
        throw new Error(`Error translating phrase: ${_.get(payload, "error.message", "Unknown error")}`);

    if (!_.isPlainObject(payload))
        throw new Error("Error decoding translation response");

    const {success, error: validateError, data} = await TranslationResponseSchema.safeParseAsync(payload);
    if (!success || !data)
        throw new Error(`Error parsing translation response: ${validateError?.message}`);

    if (data.pretranslatedPhrase !== phrase)
        throw new Error("Pretranslated phrase does not match original phrase");

    if (data.sourceLanguage === data.targetLanguage)
        throw new Error("Source and target languages are the same");

    if (!hints.includes(data.sourceLanguage) || !hints.includes(data.targetLanguage))
        throw new Error("Source and target languages are not in hints");

    return {
        ...data,
        timestamp: data.timestamp
    };
}
