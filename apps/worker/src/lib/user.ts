import { UniTiers, UserRoleSchema } from "@uni/api";
import type { Context } from "hono";
import * as _ from "radashi";
import type { z } from "zod/v4";
import type { THono } from "./types";

export async function getTier(c: Context<THono>): Promise<(typeof UniTiers)[keyof typeof UniTiers]> {
	const user = c.get("user");
	const supabase = c.get("supabase");

	const { data: tier, error } = await supabase.rpc("get_tier", {
		user_id: user.id
	});

	if (error) throw new Error(`Failed to get user tier: ${error.message}`);

	if (_.isNullish(tier) || !(Object.values(UniTiers) as number[]).includes(tier)) throw new Error(`Invalid tier value: ${tier}`);

	// @ts-expect-error "tier" casting to relevant tier type
	return tier ?? 0;
}

export async function getRole(c: Context<THono>): Promise<z.infer<typeof UserRoleSchema>> {
	const user = c.get("user");
	const supabase = c.get("supabase");

	const { data, error } = await supabase.from("users").select("role").eq("id", user.id).single();
	if (error) throw new Error(`Failed to get user role: ${error.message}`);

	return UserRoleSchema.parse(data.role);
}
