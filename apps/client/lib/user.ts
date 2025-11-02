import * as _ from "radashi";
import { z } from "zod";
import { uniApi } from "./networking";

export const UserTierSchema = z.enum(["free", "basic", "max"]);

export const UserMetadataSchema = z.object({
  id: z.string(),
  email: z.email(),
  tier: UserTierSchema
});

export async function getUserAdditionalData() {
  const response = await uniApi.get("/user");
  const payload = response.data;
  if (payload.error)
    throw new Error(`${_.get(payload, "error.message", "Unknown error")}`);

  const { success, error: validateError, data } = await UserMetadataSchema.safeParseAsync(payload);
  if (!success || !data)
    throw new Error(`Error parsing user metadata response: ${validateError?.message}`);

  return data;
}
