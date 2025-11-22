import { createClient, type REALTIME_POSTGRES_CHANGES_LISTEN_EVENT } from "@supabase/supabase-js";
import { getTierById, UniMonthlyLimits, UniTiers } from "@uni/api";
import { type Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";
import * as _ from "radashi";
import type { Database } from "../lib/database.types";
import type { THono } from "../lib/types";
import { getUsage } from "../lib/usage";
import { withMsgpack } from "../lib/utils";

const userRouter = new Hono<THono>();

userRouter.post("/create", async (c) => {
	const payload = await c.req.json();
	const adminSupabase = createClient<Database>(c.env.SUPABASE_URL, c.env.SUPABASE_ADMIN_KEY);

	const type: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = _.get(payload, "type");
	const table: string = _.get(payload, "table");
	const schema: string = _.get(payload, "schema");
	const record: object = _.get(payload, "record");

	if (type !== "INSERT" || schema !== "auth" || table !== "users") {
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: c.json({
				error: {
					http_code: StatusCodes.BAD_REQUEST,
					message: "Invalid sign up webhook payload"
				}
			})
		});
	}

	if (!["id", "email"].every((key) => !_.isNullish(_.get(record, key)))) {
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: c.json({
				error: {
					http_code: StatusCodes.INTERNAL_SERVER_ERROR,
					message: "User ID or email is missing"
				}
			})
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
					message: "User full name is missing"
				}
			})
		});

	if (!nameFromEmail && provider === "apple")
		throw new HTTPException(StatusCodes.BAD_REQUEST, {
			res: c.json({
				error: {
					http_code: StatusCodes.BAD_REQUEST,
					message: "User name from email is missing when using Apple provider"
				}
			})
		});

	const { error: userError } = await adminSupabase.from("users").insert({
		id,
		name: provider === "apple" ? nameFromEmail : name,
		email,
		tier: 0
	});
	if (userError)
		throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
			res: c.json({
				error: {
					http_code: StatusCodes.INTERNAL_SERVER_ERROR,
					message: `Failed to create user: ${userError.message}`
				}
			})
		});

	const { error: usageError } = await adminSupabase.from("usage").insert({
		id
	});
	if (usageError)
		throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
			res: c.json({
				error: {
					http_code: StatusCodes.INTERNAL_SERVER_ERROR,
					message: `Failed to create usage record: ${usageError.message}`
				}
			})
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
						message: "Unauthorized"
					}
				},
				c
			)
		});
	}

	const { tier } = await updateUserTier(id, c);

	const { error, data } = await supabase.from("users").select("*").eq("id", id).single();
	if (error) {
		throw new HTTPException(StatusCodes.NOT_FOUND, {
			res: withMsgpack(
				{
					error: {
						http_code: StatusCodes.NOT_FOUND,
						message: `${error.message}`
					}
				},
				c
			)
		});
	}

	const speechTranslationLimit = UniMonthlyLimits["speech_translation"][getTierById(tier)];
	const speechTranslationUsage = await getUsage(c, "speech_translation");

	return withMsgpack(
		{
			id: data.id,
			email: data.email,
			tier: data.tier,
			limits: {
				speech_translation: {
					monthly_limit: speechTranslationLimit,
					usage: speechTranslationUsage
				}
			}
		},
		c
	);
});

userRouter.post("/request-purchase-fulfillment", async (c) => {
	const user = c.get("user");
	const userId = user?.id;

	const { tier, items } = await updateUserTier(userId, c);

	return withMsgpack(
		{
			activeEntitlements: items.map((item) => item.entitlement_id),
			tier
		},
		c
	);
});

async function updateUserTier(userId: string, c: Context<THono>) {
	const adminSupabase = createClient<Database>(`${process.env.SUPABASE_URL}`, `${process.env.SUPABASE_ADMIN_KEY}`);

	const response = await fetch(`https://api.revenuecat.com/v2/projects/proj596f0d76/customers/${userId}/active_entitlements`, {
		headers: {
			Authorization: `Bearer ${c.env.REVENUECAT_API_KEY}`
		}
	});
	const payload = await response.json<{
		items: {
			object: string;
			entitlement_id: string;
			expires_at: number;
		}[];
	}>();
	if (!response.ok)
		throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
			res: withMsgpack(
				{
					error: {
						message: `Failed to fetch active entitlements: ${_.get(payload, "type", "unknown error")}`
					}
				},
				c
			)
		});

	const { items } = payload;

	console.log(items);

	const hasEntitlement = (entitlement: string) => items.some((item) => item.entitlement_id === entitlement);
	let tier: (typeof UniTiers)[keyof typeof UniTiers] = 0;
	if (hasEntitlement("entl66ecdebf11")) tier = UniTiers.basic;
	if (hasEntitlement("entlf02ae41ac8")) tier = UniTiers.max;

	const { error } = await adminSupabase
		.from("users")
		.update({
			tier
		})
		.eq("id", userId);
	if (error)
		throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
			res: withMsgpack(
				{
					error: {
						message: `Failed to update user tier: ${error.message}`
					}
				},
				c
			)
		});

	return {
		tier,
		items
	};
}

export default userRouter;
