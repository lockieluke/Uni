import { createClient } from "@supabase/supabase-js";
import { Context } from "hono";
import { Database } from "./database.types";
import { THono } from "./types";

export async function incrementUsage(c: Context<THono>, usageName: string) {
    const adminSupabase = createClient<Database>(c.env.SUPABASE_URL, c.env.SUPABASE_ADMIN_KEY);
    const user = c.get("user");

    const {error} = await adminSupabase.rpc("increment_usage", {
        usage_name: usageName,
        user_id: user.id
    });
    if (error)
        throw new Error(`Failed to increment usage: ${error.message}`);
}

export async function getUsage(c: Context<THono>, usageName: string) {
    const supabase = c.get("supabase");
    const user = c.get("user");

    const {data, error} = await supabase.rpc("get_usage", {
        usage_name: usageName,
        user_id: user.id
    });
    if (error)
        throw new Error(`Failed to get usage: ${error.message}`);

    return data ?? 0;
}
