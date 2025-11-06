import { encode } from "@msgpack/msgpack";
import { Context } from "hono";
import { Buffer } from 'node:buffer';
import * as _ from "radashi";

export function withMsgpack(json: any, c: Context) {
    if (!_.isPlainObject(json))
        throw new Error("Invalid JSON object");

    c.header("Content-Type", "application/msgpack");

    const msgpackPayload = encode(json);
    return c.body(Buffer.from(msgpackPayload));
}

export async function toDataURL(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    return `data:${file.type};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
}
