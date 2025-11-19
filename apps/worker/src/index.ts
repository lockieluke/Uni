/// <reference lib="dom" />
/// <reference types="@cloudflare/workers-types" />

import { cerebras } from "@ai-sdk/cerebras";
import { decode } from "@msgpack/msgpack";
import { createClient } from "@supabase/supabase-js";
import {
	getTierById,
	LanguageSchema,
	OpenAITranscriptionModelSchema,
	TranscriptionProviderSchema,
	TranslationLLMMPropertySchema,
	UniMonthlyLimits,
} from "@uni/api";
import { generateObject, type LanguageModel } from "ai";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import { endTime, setMetric, startTime, timing } from "hono/timing";
import { StatusCodes } from "http-status-codes";
import * as async from "modern-async";
import * as _ from "radashi";
import { z } from "zod/v4";
import {
	groq,
	openai,
	specificModelOverrideProvider,
	transcriptionModel,
	translationModel,
	translationProvider,
	useOpenRouter,
} from "./ai";
import { TranslationSchema } from "./schemas";
import type { THono } from "./types";
import { getUsage, incrementUsage } from "./usage";
import userRouter, { getTier } from "./user";
import { withMsgpack } from "./utils";

dayjs.extend(relativeTime);

const app = new Hono<THono>();

app.use(timing());

// if (!process.env.DEV) {
//   app.onError(async (err, c) => {
//     if (err instanceof HTTPException) {
//       const contentType = err.res?.headers.get("Content-Type") ?? "text/plain;charset=UTF-8";
//       if (contentType === "text/plain;charset=UTF-8") {
//         const message = await err.res?.text() ?? "An unexpected error occurred";

//         c.status(err.status);

//         return withMsgpack({
//           error: {
//             message,
//             http_code: err.status,
//             stack: c.env.DEV ? err.stack || "No stack trace available" : undefined
//           }
//         }, c);
//       }
//       return err.getResponse();
//     }

//     throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
//       res: withMsgpack({
//         error: {
//           message: err.message || "An unexpected error occurred",
//           http_code: StatusCodes.INTERNAL_SERVER_ERROR,
//           stack: c.env.DEV ? err.stack || "No stack trace available" : undefined
//         }
//       }, c)
//     });
//   });
// }

app.use("/transcript", async (c, next) => {
	await next();
	await incrementUsage(c, "speech_translation");
});

app.use("/*", async (c, next) => {
	if (c.req.path === "/user/create") return next();

	return bearerAuth({
		async verifyToken(token, c) {
			const supabase = createClient(
				c.env.SUPABASE_URL,
				c.env.SUPABASE_ANON_KEY,
				{
					global: {
						headers: {
							Authorization: `Bearer ${token}`,
						},
					},
				},
			);
			const {
				data: { user },
				error,
			} = await supabase.auth.getUser();
			if (error) {
				console.error("Error verifying token:", error.message);
				return false;
			}

			c.set("supabase", supabase);

			if (user) c.set("user", user);

			return !!user && !error;
		},
	})(c, next);
});

app.post("/transcript", async (c) => {
	const formData = await c.req.parseBody();
	if (!formData) {
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: withMsgpack(
				{
					error: {
						message: "No form data found",
					},
				},
				c,
			),
		});
	}

	startTime(c, "check-speech-usage");

	const [usage, tier] = await Promise.all([
		getUsage(c, "speech_translation"),
		getTier(c),
	]);
	if (usage >= UniMonthlyLimits["speech_translation"][getTierById(tier)])
		throw new HTTPException(StatusCodes.FORBIDDEN, {
			res: withMsgpack(
				{
					error: {
						message: `Monthly limit reached for speech translation on tier ${tier}`,
					},
				},
				c,
			),
		});

	endTime(c, "check-speech-usage");

	const file = formData["file"];
	if (!file || !(file instanceof File)) {
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: withMsgpack(
				{
					error: {
						message: "No file found",
					},
				},
				c,
			),
		});
	}

	const { data: provider, success } =
		await TranscriptionProviderSchema.safeParseAsync(
			c.req.query("provider") || "openai",
		);
	if (!success)
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: withMsgpack(
				{
					error: {
						message: `Invalid provider "${provider}"`,
					},
				},
				c,
			),
		});

	setMetric(c, "provider", provider);

	startTime(c, "transcription");

	const transcriptStart = dayjs();

	const {
		data: mode,
		error,
		success: modeSuccess,
	} = await OpenAITranscriptionModelSchema.safeParseAsync(
		c.req.query("mode") ?? "fast",
	);
	if (!modeSuccess || !mode)
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: withMsgpack(
				{
					error: {
						message: `Invalid mode "${mode}": ${error?.message}`,
					},
				},
				c,
			),
		});

	if (provider === "groq") {
		try {
			const { text } = await groq.audio.transcriptions.create({
				file,
				model: "whisper-large-v3-turbo",
				prompt:
					"When transcribing audio in Cantonese, please use the Cantonese dialect",
				response_format: "json",
				temperature: 0,
			});
			const transcriptTiming = dayjs().diff(transcriptStart, "millisecond");
			if (c.env.DEV)
				console.log(
					`Transcribing file ${file.name} took ${transcriptTiming}ms`,
				);

			return withMsgpack(
				{
					transcript: text,
					timing: transcriptTiming,
				},
				c,
			);
		} catch (error) {
			console.error("Error during transcription:", error);
			throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
				res: withMsgpack(
					{
						error: {
							message:
								error instanceof Error
									? error.message
									: "An error occurred during transcription",
						},
					},
					c,
				),
			});
		}
	}

	if (provider === "openai") {
		const { text } = await openai.audio.transcriptions.create({
			file,
			model: transcriptionModel[mode],
			response_format: "json",
			temperature: 0,
		});

		const transcriptTiming = dayjs().diff(transcriptStart, "millisecond");
		if (c.env.DEV)
			console.log(`Transcribing file ${file.name} took ${transcriptTiming}ms`);

		endTime(c, "transcription");

		if (!text) {
			throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
				res: withMsgpack(
					{
						error: {
							message: "No text found in response",
						},
					},
					c,
				),
			});
		}

		return withMsgpack(
			{
				transcript: text,
				timing: transcriptTiming,
			},
			c,
		);
	}

	if (provider === "openai-realtime") {
		const sstStream = await openai.audio.transcriptions.create({
			file,
			model: transcriptionModel[mode],
			response_format: "json",
			stream: true,
		});

		return streamSSE(c, async (stream) => {
			let id = 0;
			for await (const event of sstStream) {
				if (event.type === "transcript.text.delta") {
					await stream.writeSSE({
						event: "transcript",
						data: event.delta,
						id: String(id++),
					});
				}

				if (event.type === "transcript.text.done")
					await stream.writeSSE({
						event: "done",
						data: event.text,
						id: String(id++),
					});
			}
		});
	}

	return withMsgpack({}, c);
});

app.post("/translate", async (c) => {
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
						message: reqBody.error.message,
					},
				},
				c,
			),
		});
	}

	const { phrase, hints } = reqBody.data;
	const { data: mode, success } =
		await TranslationLLMMPropertySchema.safeParseAsync(
			c.req.query("mode") || "default",
		);
	if (!success)
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: withMsgpack(
				{
					error: {
						message: `Invalid mode "${mode}"`,
					},
				},
				c,
			),
		});

	const totalTiming = performance.now();

	const languageSpecificPrompts: Map<string, string | null> = new Map();
	const languageModelOverrides: Map<string, string> = new Map();
	const KV_CACHE_ENABLED = !c.env.DEV || process.env.KV_CACHE_ENABLED;
	await async.asyncForEach(hints, async (hint) => {
		let specificPromptCacheHit = false;
		const retrieveLanguagePromptCache = async () => {
			const langCache = await LANG_CACHE.getWithMetadata<string>(hint, {
				type: "text",
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
					type: "text",
				});
			const fetchedAt = dayjs(
				_.get(langModelOverrideCache.metadata, "fetchedAt"),
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
			retrieveLanguageModelOverrideCache(),
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
								message: `Error fetching language prompt for ${hint}: ${languagePromptsError.message}`,
							},
						},
						c,
					),
				});
			}

			const customPrompt = languagePromptsData.custom_prompt;
			await LANG_CACHE.put(hint, customPrompt ?? "null", {
				metadata: {
					fetchedAt: dayjs().toJSON(),
				},
			});

			languageSpecificPrompts.set(hint, languagePromptsData?.custom_prompt);
		}

		if (!modelOverrideCacheHit) {
			const {
				data: languageModelOverrideData,
				error: languageModelOverrideError,
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
								message: `Error fetching language model override for ${hint}: ${languageModelOverrideError.message}`,
							},
						},
						c,
					),
				});
			}

			const modelOverride = languageModelOverrideData.model_override;
			await LANG_MO_CACHE.put(hint, modelOverride ?? "null", {
				metadata: {
					fetchedAt: dayjs().toJSON(),
				},
			});

			if (modelOverride) languageModelOverrides.set(hint, modelOverride);
		}
	});

	if (c.env.DEV)
		console.log(
			`Configured translation engine for phrase ${phrase} in ${performance.now() - totalTiming}ms`,
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
            `.trim(),
				},
				{
					role: "user",
					content: `Phrase is "${phrase}"`,
				},
			],
			schema: z.object({
				pretranslatedPhrase: z
					.string()
					.describe("The phrase before translation"),
				translatedPhrase: z.string().describe("The phrase after translation"),
				sourceLanguage: z.string(),
				targetLanguage: z.string(),
			}),
			temperature: 0,
			providerOptions: {
				...(mode === "ultrafast"
					? {}
					: mode === "default" && !_.isNullish(autoModel)
						? specificModelOverrideProvider[autoModel.toString()]
						: translationProvider[mode]),
			},
		});

		if (c.env.DEV)
			console.log(
				`Complete translation of phrase ${phrase} to ${object.targetLanguage} took ${performance.now() - totalTiming}ms, ${response.modelId} took ${performance.now() - translationTiming}ms for inference`,
			);

		const additionalData = {
			..._.pick(response, ["id", "modelId", "timestamp"]),
		};

		if (finishReason === "error") {
			throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
				res: withMsgpack(
					{
						error: {
							message: "Error in translation",
						},
					},
					c,
				),
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
							message: `Failed to translate, model returned "${object.sourceLanguage}" and "${object.targetLanguage}" but hints were "${hints.join(", ")}"`,
						},
					},
					c,
				),
			});
		}

		return withMsgpack(
			{
				...object,
				...additionalData,
			},
			c,
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
								: "An error occurred during translation",
					},
				},
				c,
			),
		});
	}
});

app.get("/languages", async (c) => {
	const languages: {
		[key: string]: z.infer<typeof LanguageSchema>;
	} = {};

	const supabase = c.get("supabase");
	const { data, error } = await supabase.from("languages").select("*");
	if (error)
		throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
			res: withMsgpack(
				{
					error: {
						message: `Error fetching languages: ${error.message}`,
					},
				},
				c,
			),
		});

	if (!data) {
		throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
			res: withMsgpack(
				{
					error: {
						message: "No languages found",
					},
				},
				c,
			),
		});
	}

	await async.asyncForEach(data, async (lang) => {
		const {
			success,
			data: parsedLang,
			error,
		} = await LanguageSchema.safeParseAsync(
			_.mapKeys(
				_.shake(lang, (v) => _.isNullish(v)),
				(key: string) => _.camel(key),
			),
		);
		if (!success) {
			throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
				res: withMsgpack(
					{
						error: {
							message: `Error parsing language "${lang.lang}": ${error?.message}`,
						},
					},
					c,
				),
			});
		}

		if (parsedLang) languages[lang.lang] = parsedLang;
	});

	return withMsgpack(
		{
			languages,
		},
		c,
	);
});

app.route("/user", userRouter);

export default app;
