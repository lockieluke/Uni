import { UserMetadataSchema } from "@uni/api";
import * as _ from "radashi";
import { uniApi } from "./networking";

export async function getUserAdditionalData() {
	const response = await uniApi.get("/user");
	const payload = response.data;
	if (payload.error) throw new Error(`${_.get(payload, "error.message", "Unknown error")}`);

	const { success, error: validateError, data } = await UserMetadataSchema.safeParseAsync(payload);
	if (!success || !data) throw new Error(`Error parsing user metadata response: ${validateError?.message}`);

	return data;
}

export async function requestPurchaseFulfillment() {
	const response = await uniApi.post("/user/request-purchase-fulfillment");
	const payload = response.data;
	if (payload.error) throw new Error(`${_.get(payload, "error.message", "Unknown error")}`);
}
