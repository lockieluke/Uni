import { Buffer } from "node:buffer";
import { encode } from "@msgpack/msgpack";
import type { Context } from "hono";
import * as _ from "radashi";

export function withMsgpack(json: unknown, c: Context) {
	if (!_.isPlainObject(json)) throw new Error("Invalid JSON object");

	c.header("Content-Type", "application/msgpack");

	const msgpackPayload = encode(json);
	return c.body(Buffer.from(msgpackPayload));
}

export async function toDataURL(file: File) {
	const arrayBuffer = await file.arrayBuffer();
	return `data:${file.type};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
}
