import { decode } from "@msgpack/msgpack";
import * as _ from "radashi";
import { z } from "zod/v4";
import { supabase } from "./supabase";

const UserMetadataSchema = z.object({
    id: z.string(),
    email: z.email(),
    tier: z.enum(["free", "basic", "max"])
});

export async function getUserMetadata() {
    const {data: {session}, error} = await supabase.auth.getSession();
    if (error)
        throw new Error("Error getting session when fetching user metadata");
    const user = session?.user;
    if (!user)
        throw new Error("No user session found when fetching user metadata");

    const response = await fetch(`https://uni-api.lockie.dev/user`, {
        headers: {
            "Content-Type": "application/x-msgpack",
            "Authorization": `Bearer ${session?.access_token}`,
            "User-Agent": "Uni/1.0.0"
        }
    });
    const payload = decode(await response.arrayBuffer());
    if (!response.ok)
        throw new Error(`${_.get(payload, "error.message", "Unknown Error")}`);

    if (!_.isPlainObject(payload))
        throw new Error("Error decoding user metadata response");

    const {success, error: validateError, data} = await UserMetadataSchema.safeParseAsync(payload);
    if (!success || !data)
        throw new Error(`Error parsing user metadata response: ${validateError?.message}`);

    return data;
}