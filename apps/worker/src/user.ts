import {
	createClient,
	type REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
} from "@supabase/supabase-js";
import { getTierById, UniMonthlyLimits, UniTiers } from "@uni/api";
import { type Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";
import * as _ from "radashi";
import type { Database } from "./database.types";
import type { THono } from "./types";
import { getUsage } from "./usage";
import { withMsgpack } from "./utils";

const userRouter = new Hono<THono>();

export async function getTier(
	c: Context<THono>,
): Promise<(typeof UniTiers)[keyof typeof UniTiers]> {
	const user = c.get("user");
	const supabase = c.get("supabase");

	const { data: tier, error } = await supabase.rpc("get_tier", {
		user_id: user.id,
	});

	if (error) throw new Error(`Failed to get user tier: ${error.message}`);

	if (
		_.isNullish(tier) ||
		!(Object.values(UniTiers) as number[]).includes(tier)
	)
		throw new Error(`Invalid tier value: ${tier}`);

	// @ts-expect-error "tier" casting to relevant tier type
	return tier ?? 0;
}

userRouter.post("/create", async (c) => {
	const payload = await c.req.json();
	const adminSupabase = createClient<Database>(
		c.env.SUPABASE_URL,
		c.env.SUPABASE_ADMIN_KEY,
	);

	const type: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = _.get(payload, "type");
	const table: string = _.get(payload, "table");
	const schema: string = _.get(payload, "schema");
	const record: object = _.get(payload, "record");

	if (type !== "INSERT" || schema !== "auth" || table !== "users") {
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: c.json({
				error: {
					http_code: StatusCodes.BAD_REQUEST,
					message: "Invalid sign up webhook payload",
				},
			}),
		});
	}

	if (!["id", "email"].every((key) => !_.isNullish(_.get(record, key)))) {
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: c.json({
				error: {
					http_code: StatusCodes.INTERNAL_SERVER_ERROR,
					message: "User ID or email is missing",
				},
			}),
		});
	}
	const id: string = _.get(record, "id");
	const userMetadata = _.get(record, "raw_user_meta_data");
	const appMetadata = _.get(record, "raw_app_meta_data");
	const provider: string = _.get(appMetadata, "provider");
	const name: string = _.get(userMetadata, "full_name");
	const email: string = _.get(record, "email");
	const nameFromEmail = email?.substring(0, email.indexOf("@"));

	if (!name && provider !== "apple")
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: c.json({
				error: {
					http_code: StatusCodes.BAD_REQUEST,
					message: "User full name is missing",
				},
			}),
		});

	if (!nameFromEmail && provider === "apple")
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: c.json({
				error: {
					http_code: StatusCodes.BAD_REQUEST,
					message: "User name from email is missing when using Apple provider",
				},
			}),
		});

	const { error: userError } = await adminSupabase.from("users").insert({
		id,
		name: provider === "apple" ? nameFromEmail : name,
		email,
		tier: 0,
	});
	if (userError)
		throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
			res: c.json({
				error: {
					http_code: StatusCodes.INTERNAL_SERVER_ERROR,
					message: `Failed to create user: ${userError.message}`,
				},
			}),
		});

	const { error: usageError } = await adminSupabase.from("usage").insert({
		id,
	});
	if (usageError)
		throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
			res: c.json({
				error: {
					http_code: StatusCodes.INTERNAL_SERVER_ERROR,
					message: `Failed to create usage record: ${usageError.message}`,
				},
			}),
		});

	return c.json({});
});

userRouter.get("/", async (c) => {
	const supabase = c.get("supabase");
	const user = c.get("user");
	const id = user?.id;
	if (!id) {
		throw new HTTPException(StatusCodes.UNAUTHORIZED, {
			res: withMsgpack(
				{
					error: {
						http_code: StatusCodes.UNAUTHORIZED,
						message: "Unauthorized",
					},
				},
				c,
			),
		});
	}

	const { error, data } = await supabase
		.from("users")
		.select("*")
		.eq("id", id)
		.single();
	if (error) {
		throw new HTTPException(StatusCodes.NOT_FOUND, {
			res: withMsgpack(
				{
					error: {
						http_code: StatusCodes.NOT_FOUND,
						message: `${error.message}`,
					},
				},
				c,
			),
		});
	}

	const tier = getTierById(data.tier as never);

	const speechTranslationLimit = UniMonthlyLimits["speech_translation"][tier];
	const speechTranslationUsage = await getUsage(c, "speech_translation");

	return withMsgpack(
		{
			id: data.id,
			email: data.email,
			tier: data.tier,
			limits: {
				speech_translation: {
					monthly_limit: speechTranslationLimit,
					usage: speechTranslationUsage,
				},
			},
		},
		c,
	);
});

export default userRouter;
