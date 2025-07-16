import * as _ from "radashi";
import { uniApi } from "./networking";
import { mmkvStorage } from "./storage";

export default async function transcript(uri: string, hints: string[]): Promise<{
    language: string,
    transcript: string;
} | null> {
    console.log("Sending audio to OpenAI:", uri);

    const useMoreAccurateModel = (await mmkvStorage.getBoolAsync("accurateTranscriptionModel")) ?? false;

    const formData = new FormData();
    formData.append("file", {
        uri: uri,
        name: "audio.m4a",
        type: "audio/m4a"
    } as any);

    const response = await uniApi.postForm("/transcript", formData, {
        params: {
            mode: useMoreAccurateModel ? "accurate" : "fast"
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

