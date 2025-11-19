import { cerebras } from "@ai-sdk/cerebras";
import { decode } from "@msgpack/msgpack";
import { TranslationLLMMPropertySchema } from "@uni/api";
import { generateObject, type LanguageModel } from "ai";
import dayjs from "dayjs";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";
import * as async from "modern-async";
import * as _ from "radashi";
import { z } from "zod/v4";
import {
	specificModelOverrideProvider,
	translationModel,
	translationProvider,
	useOpenRouter
} from "../ai";
import { TranslationSchema } from "../schemas";
import type { THono } from "../types";
import { withMsgpack } from "../utils";

const translateRouter = new Hono<THono>();

translateRouter.post("/", async (c) => {
	const payload = decode(await c.req.arrayBuffer());
	const reqBody = await TranslationSchema.safeParseAsync(payload);
	const supabase = c.get("supabase");
	const LANG_CACHE = c.env.LANG_CACHE;
	const LANG_MO_CACHE = c.env.LANG_MO_CACHE;
	if (!reqBody.success) {
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: withMsgpack(
				{
					error: {
						message: reqBody.error.message
					}
				},
				c
			)
		});
	}

	const { phrase, hints } = reqBody.data;
	const { data: mode, success } =
		await TranslationLLMMPropertySchema.safeParseAsync(
			c.req.query("mode") || "default"
		);
	if (!success)
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: withMsgpack(
				{
					error: {
						message: `Invalid mode "${mode}"`
					}
				},
				c
			)
		});

	const totalTiming = performance.now();

	const languageSpecificPrompts: Map<string, string | null> = new Map();
	const languageModelOverrides: Map<string, string> = new Map();
	const KV_CACHE_ENABLED = !c.env.DEV || process.env.KV_CACHE_ENABLED;
	await async.asyncForEach(hints, async (hint) => {
		let specificPromptCacheHit = false;
		const retrieveLanguagePromptCache = async () => {
			const langCache = await LANG_CACHE.getWithMetadata<string>(hint, {
				type: "text"
			});
			const fetchedAt = dayjs(_.get(langCache.metadata, "fetchedAt"));
			const value = langCache.value;
			if (
				dayjs().diff(fetchedAt, "hour") < 12 &&
				KV_CACHE_ENABLED &&
				!_.isNullish(value)
			) {
				languageSpecificPrompts.set(hint, value === "null" ? null : value);
				specificPromptCacheHit = true;
			}
		};

		let modelOverrideCacheHit = false;
		const retrieveLanguageModelOverrideCache = async () => {
			const langModelOverrideCache =
				await LANG_MO_CACHE.getWithMetadata<string>(hint, {
					type: "text"
				});
			const fetchedAt = dayjs(
				_.get(langModelOverrideCache.metadata, "fetchedAt")
			);
			const value = langModelOverrideCache.value;
			if (
				dayjs().diff(fetchedAt, "hour") < 12 &&
				KV_CACHE_ENABLED &&
				!_.isNullish(value) &&
				value !== "null"
			) {
				languageModelOverrides.set(hint, value);
				modelOverrideCacheHit = true;
			}
		};

		await Promise.all([
			retrieveLanguagePromptCache(),
			retrieveLanguageModelOverrideCache()
		]);

		if (!specificPromptCacheHit) {
			const { data: languagePromptsData, error: languagePromptsError } =
				await supabase
					.from("languages")
					.select("custom_prompt")
					.eq("lang", hint)
					.single();
			if (languagePromptsError) {
				throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
					res: withMsgpack(
						{
							error: {
								message: `Error fetching language prompt for ${hint}: ${languagePromptsError.message}`
							}
						},
						c
					)
				});
			}

			const customPrompt = languagePromptsData.custom_prompt;
			await LANG_CACHE.put(hint, customPrompt ?? "null", {
				metadata: {
					fetchedAt: dayjs().toJSON()
				}
			});

			languageSpecificPrompts.set(hint, languagePromptsData?.custom_prompt);
		}

		if (!modelOverrideCacheHit) {
			const {
				data: languageModelOverrideData,
				error: languageModelOverrideError
			} = await supabase
				.from("languages")
				.select("model_override")
				.eq("lang", hint)
				.single();
			if (languageModelOverrideError) {
				throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
					res: withMsgpack(
						{
							error: {
								message: `Error fetching language model override for ${hint}: ${languageModelOverrideError.message}`
							}
						},
						c
					)
				});
			}

			const modelOverride = languageModelOverrideData.model_override;
			await LANG_MO_CACHE.put(hint, modelOverride ?? "null", {
				metadata: {
					fetchedAt: dayjs().toJSON()
				}
			});

			if (modelOverride) languageModelOverrides.set(hint, modelOverride);
		}
	});

	if (c.env.DEV)
		console.log(
			`Configured translation engine for phrase ${phrase} in ${performance.now() - totalTiming}ms`
		);

	const flattenedLanguageSpecificPrompts = languageSpecificPrompts
		.values()
		.toArray();

	let autoModel: LanguageModel | undefined;
	const languageModelOverrideArr = languageModelOverrides.values().toArray();
	// TODO: Using last model override found for now
	const modelOverride = languageModelOverrideArr
		.filter((override) => !_.isNullish(override))
		.at(-1);
	if (modelOverride) {
		const [prefix, model] = modelOverride.split(":");
		if (prefix === "cerebras") autoModel = cerebras(model);
		else if (prefix === "openrouter") autoModel = useOpenRouter(model);
	}

	const translationTiming = performance.now();

	try {
		const { object, finishReason, response } = await generateObject({
			model:
				mode === "default" && !_.isNullish(autoModel)
					? autoModel
					: mode === "ultrafast" || mode === "default"
						? cerebras("qwen-3-235b-a22b-instruct-2507")
						: useOpenRouter(translationModel[mode]),
			messages: [
				{
					role: "system",
					content: `
You are given a phrase.  This phrase could be in the languages represented by these language codes: ${hints.join(", ")}
1. Detect the source language of the phrase.
2. Identify the target language as the other code in the pair.
3. Translate the phrase into the target language.
4. In your response, include the source language code, the target language code, and the translated phrase.
${flattenedLanguageSpecificPrompts.length > 0 ? `\nLanguage specific instructions: ${flattenedLanguageSpecificPrompts.filter((prompt) => !_.isNullish(prompt) && prompt !== "null").join("\n\n")}\n` : ""}
Do not interpret the phrase, just translate it.
Please also remove any garbage characters or transcription errors that might not contain any of the source langauges from the pretranslated phrase.
            `.trim()
				},
				{
					role: "user",
					content: `Phrase is "${phrase}"`
				}
			],
			schema: z.object({
				pretranslatedPhrase: z
					.string()
					.describe("The phrase before translation"),
				translatedPhrase: z.string().describe("The phrase after translation"),
				sourceLanguage: z.string(),
				targetLanguage: z.string()
			}),
			temperature: 0,
			providerOptions: {
				...(mode === "ultrafast"
					? {}
					: mode === "default" && !_.isNullish(autoModel)
						? specificModelOverrideProvider[autoModel.toString()]
						: translationProvider[mode])
			}
		});

		if (c.env.DEV)
			console.log(
				`Complete translation of phrase ${phrase} to ${object.targetLanguage} took ${performance.now() - totalTiming}ms, ${response.modelId} took ${performance.now() - translationTiming}ms for inference`
			);

		const additionalData = {
			..._.pick(response, ["id", "modelId", "timestamp"])
		};

		if (finishReason === "error") {
			throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
				res: withMsgpack(
					{
						error: {
							message: "Error in translation"
						}
					},
					c
				)
			});
		}

		if (
			!(
				hints.includes(object.sourceLanguage) &&
				hints.includes(object.targetLanguage)
			)
		) {
			throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
				res: withMsgpack(
					{
						error: {
							message: `Failed to translate, model returned "${object.sourceLanguage}" and "${object.targetLanguage}" but hints were "${hints.join(", ")}"`
						}
					},
					c
				)
			});
		}

		return withMsgpack(
			{
				...object,
				...additionalData
			},
			c
		);
	} catch (error) {
		console.error("Translation error:", error);
		throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
			res: withMsgpack(
				{
					error: {
						message:
							error instanceof Error
								? error.message
								: "An error occurred during translation"
					}
				},
				c
			)
		});
	}
});

export default translateRouter;
