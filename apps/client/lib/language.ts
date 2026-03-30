import { encode } from "@msgpack/msgpack";
import type { TranslationLLMMPropertySchema, TranslationSchema } from "@uni/api";
import { getLocales } from "expo-localization";
import * as _ from "radashi";
import { z } from "zod/v4";
import { uniApi } from "./networking";
import type { TClientLanguage } from "./states";
import { mmkvStorage } from "./storage";

const TranslationResponseSchema = z.object({
	pretranslatedPhrase: z.string(),
	translatedPhrase: z.string(),
	sourceLanguage: z.string(),
	targetLanguage: z.string(),
	id: z.string(),
	modelId: z.string(),
	timestamp: z.date()
});

export async function getLanguages(hostLang: string = getLocales()[0].languageCode ?? "en-GB"): Promise<{ [key: string]: TClientLanguage }> {
	const disableCache = (await mmkvStorage.getBoolAsync("disableCache")) ?? false;

	const response = await uniApi.get("/languages", {
		headers: disableCache
			? {
					"Cache-Control": "no-cache",
					Pragma: "no-cache",
					Expires: "0"
				}
			: {}
	});
	const payload = response.data;
	if (payload.error) throw new Error(`${_.get(payload, "error.message", "Unknown error")}`);
	const languages = _.get(payload, "languages", {});

	return {
		..._.mapValues(languages, (language, key) => ({
			...(_.isPlainObject(language) ? language : {}),
			displayName: _.get(language, `displayName.${hostLang}`, _.get(language, "displayName.en-GB")),
			code: key
		}))
	};
}

export async function summariseConversation(phrases: { [key: string]: string }[]) {
	const response = await uniApi.post<{
		titles: { [key: string]: string };
	}>(
		"/context/summary",
		JSON.stringify({
			phrases
		}),
		{
			headers: {
				"Content-Type": "application/json"
			}
		}
	);
	const { titles } = response.data;

	return titles;
}

export async function translatePhrase(
	{ hints, phrase, history }: z.infer<typeof TranslationSchema>,
	model: z.infer<typeof TranslationLLMMPropertySchema> = "default"
) {
	const response = await uniApi.post(
		"/translate",
		encode({
			phrase,
			hints,
			history
		}),
		{
			params: {
				mode: model
			},
			timeout: 60 * 1000
		}
	);
	const payload = response.data;

	const { success, error: validateError, data } = await TranslationResponseSchema.safeParseAsync(payload);
	if (!success || !data) throw new Error(`Error parsing translation response: ${validateError?.message}`);

	if (data.pretranslatedPhrase !== phrase) throw new Error("Pretranslated phrase does not match original phrase");

	if (data.sourceLanguage === data.targetLanguage) throw new Error("Source and target languages are the same");

	if (!hints.includes(data.sourceLanguage) || !hints.includes(data.targetLanguage)) throw new Error("Source and target languages are not in hints");

	return {
		...data,
		timestamp: data.timestamp
	};
}
