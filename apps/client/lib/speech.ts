import { OpenAITranscriptionModelSchema, TranscriptionProviderSchema } from "@uni/api";
import * as _ from "radashi";
import EventSource from "react-native-sse";
import { z } from "zod/v4";
import { UNI_API_BASE_URL, uniApi } from "./networking";
import { supabase } from "./supabase";
import { File } from "expo-file-system";
import { getDefaultStore } from "jotai";
import { userAtom } from "./states";

export async function transcriptRealtime(uri: string, mode: z.infer<typeof OpenAITranscriptionModelSchema> = "accurate", callback?: (transcript: string) => void) {
  return new Promise<string>(async (resolve, reject) => {
    const file = new File(uri);
    if (!file.exists)
      reject(new Error("File does not exist at provided URI"));

    const formData = new FormData();
    formData.append("file", {
      uri: uri,
      name: "audio.wav",
      type: "audio/wav"
    } as any);

    const accessToken = getDefaultStore().get(userAtom).accessToken;

    const eventSource = new EventSource<"transcript" | "done">(`${UNI_API_BASE_URL}/transcript?mode=${mode}&provider=openai-realtime`, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-msgpack",
        "User-Agent": "Uni/1.0.0",
        "Authorization": `Bearer ${accessToken}`
      },
      pollingInterval: 0
    });

    eventSource.addEventListener("open", () => {
      // console.log("Connection to Uni API opened.");
      eventSource.addEventListener("transcript", ({ data }) => {
        if (data)
          callback?.(data.replaceAll("�", ""));
      });

      const cleanup = () => {
        eventSource.removeAllEventListeners();
        eventSource.close();
      }

      eventSource.addEventListener("error", error => {
        cleanup();
        reject(error);
      })

      eventSource.addEventListener("done", ({ data }) => {
        cleanup();
        if (data)
          resolve(data);
        else
          reject();
      });
    });
  })
}

export async function transcript(uri: string, mode: z.infer<typeof OpenAITranscriptionModelSchema> = "accurate", provider: Exclude<z.infer<typeof TranscriptionProviderSchema>, "openai-realtime"> = "openai"): Promise<{
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
      mode,
      provider
    },
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
