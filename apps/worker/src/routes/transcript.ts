import {
	getTierById,
	OpenAITranscriptionModelSchema,
	TranscriptionProviderSchema,
	UniMonthlyLimits
} from "@uni/api";
import dayjs from "dayjs";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import { endTime, setMetric, startTime } from "hono/timing";
import { StatusCodes } from "http-status-codes";
import { groq, openai, transcriptionModel } from "../ai";
import type { THono } from "../types";
import { getUsage, incrementUsage } from "../usage";
import { getTier } from "../user";
import { withMsgpack } from "../utils";

const transcriptRouter = new Hono<THono>();

transcriptRouter.use("/", async (c, next) => {
	await next();
	await incrementUsage(c, "speech_translation");
});

transcriptRouter.post("/", async (c) => {
	const formData = await c.req.parseBody();
	if (!formData) {
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: withMsgpack(
				{
					error: {
						message: "No form data found"
					}
				},
				c
			)
		});
	}

	startTime(c, "check-speech-usage");

	const [usage, tier] = await Promise.all([
		getUsage(c, "speech_translation"),
		getTier(c)
	]);
	if (usage >= UniMonthlyLimits["speech_translation"][getTierById(tier)])
		throw new HTTPException(StatusCodes.FORBIDDEN, {
			res: withMsgpack(
				{
					error: {
						message: `Monthly limit reached for speech translation on tier ${tier}`
					}
				},
				c
			)
		});

	endTime(c, "check-speech-usage");

	const file = formData["file"];
	if (!file || !(file instanceof File)) {
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: withMsgpack(
				{
					error: {
						message: "No file found"
					}
				},
				c
			)
		});
	}

	const { data: provider, success } =
		await TranscriptionProviderSchema.safeParseAsync(
			c.req.query("provider") || "openai"
		);
	if (!success)
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: withMsgpack(
				{
					error: {
						message: `Invalid provider "${provider}"`
					}
				},
				c
			)
		});

	setMetric(c, "provider", provider);

	startTime(c, "transcription");

	const transcriptStart = dayjs();

	const {
		data: mode,
		error,
		success: modeSuccess
	} = await OpenAITranscriptionModelSchema.safeParseAsync(
		c.req.query("mode") ?? "fast"
	);
	if (!modeSuccess || !mode)
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: withMsgpack(
				{
					error: {
						message: `Invalid mode "${mode}": ${error?.message}`
					}
				},
				c
			)
		});

	if (provider === "groq") {
		try {
			const { text } = await groq.audio.transcriptions.create({
				file,
				model: "whisper-large-v3-turbo",
				prompt:
					"When transcribing audio in Cantonese, please use the Cantonese dialect",
				response_format: "json",
				temperature: 0
			});
			const transcriptTiming = dayjs().diff(transcriptStart, "millisecond");
			if (c.env.DEV)
				console.log(
					`Transcribing file ${file.name} took ${transcriptTiming}ms`
				);

			return withMsgpack(
				{
					transcript: text,
					timing: transcriptTiming
				},
				c
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
									: "An error occurred during transcription"
						}
					},
					c
				)
			});
		}
	}

	if (provider === "openai") {
		const { text } = await openai.audio.transcriptions.create({
			file,
			model: transcriptionModel[mode],
			response_format: "json",
			temperature: 0
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
							message: "No text found in response"
						}
					},
					c
				)
			});
		}

		return withMsgpack(
			{
				transcript: text,
				timing: transcriptTiming
			},
			c
		);
	}

	if (provider === "openai-realtime") {
		const sstStream = await openai.audio.transcriptions.create({
			file,
			model: transcriptionModel[mode],
			response_format: "json",
			stream: true
		});

		return streamSSE(c, async (stream) => {
			let id = 0;
			for await (const event of sstStream) {
				if (event.type === "transcript.text.delta") {
					await stream.writeSSE({
						event: "transcript",
						data: event.delta,
						id: String(id++)
					});
				}

				if (event.type === "transcript.text.done")
					await stream.writeSSE({
						event: "done",
						data: event.text,
						id: String(id++)
					});
			}
		});
	}

	return withMsgpack({}, c);
});

export default transcriptRouter;
