import { LanguageSchema } from "@uni/api";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";
import * as async from "modern-async";
import * as _ from "radashi";
import type { z } from "zod/v4";
import type { THono } from "../lib/types";
import { withMsgpack } from "../lib/utils";

const languagesRouter = new Hono<THono>();

languagesRouter.get("/", async (c) => {
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
						message: `Error fetching languages: ${error.message}`
					}
				},
				c
			)
		});

	if (!data) {
		throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
			res: withMsgpack(
				{
					error: {
						message: "No languages found"
					}
				},
				c
			)
		});
	}

	await async.asyncForEach(data, async (lang) => {
		const {
			success,
			data: parsedLang,
			error
		} = await LanguageSchema.safeParseAsync(
			_.mapKeys(
				_.shake(lang, (v) => _.isNullish(v)),
				(key: string) => _.camel(key)
			)
		);
		if (!success) {
			throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
				res: withMsgpack(
					{
						error: {
							message: `Error parsing language "${lang.lang}": ${error?.message}`
						}
					},
					c
				)
			});
		}

		if (parsedLang) languages[lang.lang] = parsedLang;
	});

	return withMsgpack(
		{
			languages
		},
		c
	);
});

export default languagesRouter;
