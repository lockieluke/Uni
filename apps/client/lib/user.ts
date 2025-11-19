import { UniTiers } from "@uni/api";
import * as _ from "radashi";
import { z } from "zod/v4";
import { uniApi } from "./networking";

export const UserMetadataSchema = z.object({
	id: z.string(),
	email: z.email(),
	tier: z.enum(UniTiers),
});

export async function getUserAdditionalData() {
	const response = await uniApi.get("/user");
	const payload = response.data;
	if (payload.error)
		throw new Error(`${_.get(payload, "error.message", "Unknown error")}`);

	const {
		success,
		error: validateError,
		data,
	} = await UserMetadataSchema.safeParseAsync(payload);
	if (!success || !data)
		throw new Error(
			`Error parsing user metadata response: ${validateError?.message}`,
		);

	return data;
}
