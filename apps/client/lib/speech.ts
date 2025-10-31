import * as _ from "radashi";
import { uniApi } from "./networking";

export default async function transcript(uri: string): Promise<{
    language: string,
    transcript: string;
} | null> {
    const formData = new FormData();
    formData.append("file", {
        uri: uri,
        name: "audio.m4a",
        type: "audio/m4a"
    } as any);

    const response = await uniApi.postForm("/transcript", formData, {
        params: {
            mode: "accurate",
            provider: "openai"
        }
    });
    const payload = response.data;
    if (payload.error)
        throw new Error(`${_.get(payload, "error.message", "Unknown error")}`);

    const transcript: string = _.get(payload, "transcript", "");

    return {
        language: "unknown",
        transcript
    };
}

