import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system";
import qs from "qs";
import * as _ from "radashi";
import { supabase } from "./supabase";
import { decode } from "@msgpack/msgpack";

export type TranscriptProvider = 'deepgram' | 'gladia' | 'openai';

async function deleteFromGladia(id: string): Promise<void> {
    const response = await fetch(`https://api.gladia.io/v2/pre-recorded/${id}`, {
        headers: {
            'x-gladia-key': `${process.env.EXPO_PUBLIC_GLADIA_API}`
        },
        method: "DELETE"
    });
    if (!response.ok) {
        const json = await response.json();
        console.error("Error deleting Gladia audio:", json);
        throw new Error("Error deleting Gladia audio");
    }
}

function pollGladiaTranscript(id: string, resultUrl: string): Promise<{
    language: string,
    transcript: string;
}> {
    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            console.log("Waiting for transcript from", id);
            const response = await fetch(resultUrl, {
                headers: {
                    'x-gladia-key': `${process.env.EXPO_PUBLIC_GLADIA_API}`
                }
            });
            if (!response.ok) {
                clearInterval(interval);
                reject(new Error("Error fetching Gladia transcript"));
            }
            const data = await response.json();
            if (data["status"] === "done" && data.result) {
                clearInterval(interval);

                const transcription = data.result.transcription;
                resolve({
                    transcript: transcription.full_transcript,
                    language: transcription.languages[0]
                });
            }
        }, 500);
    });
}

export default async function transcript(uri: string, provider: TranscriptProvider, hints: string[]): Promise<{
    language: string,
    transcript: string;
} | null> {
    const {data: {session}, error} = await supabase.auth.getSession();
    if (error) {
        console.error("Error getting session:", error);
        return null;
    }

    const audioBufferString = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
    });

    const audioBuffer = Buffer.from(audioBufferString, 'base64');

    if (provider === 'deepgram') {
        console.log("Sending audio to Deepgram:", uri);
        const response = await fetch(`https://api.deepgram.com/v1/listen?${qs.stringify({
            model: "nova-2",
            detect_language: true
        })}`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${process.env.EXPO_PUBLIC_DEEPGRAM_API}`,
                'Content-Type': 'audio/m4a',
            },
            body: audioBuffer,
        });
        if (!response.ok) {
            console.error("Error sending audio to Deepgram:", response.body);
            return null;
        }

        const data = await response.json();
        const transcript: string = data.results?.channels[0]?.alternatives[0]?.transcript || '';
        const language: string = data.results?.channels[0]?.detected_language || '';

        return {
            language,
            transcript
        };
    }

    if (provider === 'gladia') {
        console.log("Sending audio to Gladia:", uri);

        const uploadFormData = new FormData();
        uploadFormData.append("audio", {
            uri: uri,
            name: "audio.m4a",
            type: "audio/m4a"
        } as any);

        const uploadResponse = await fetch(`https://api.gladia.io/v2/upload`, {
            method: 'POST',
            headers: {
                'x-gladia-key': `${process.env.EXPO_PUBLIC_GLADIA_API}`,
                'Content-Type': "multipart/form-data"
            },
            body: uploadFormData
        });
        if (!uploadResponse.ok) {
            const json = await uploadResponse.json();
            console.error("Error uploading audio to Gladia:", json);
            return null;
        }
        const uploadData = await uploadResponse.json();

        const response = await fetch(`https://api.gladia.io/v2/pre-recorded`, {
            headers: {
                'x-gladia-key': `${process.env.EXPO_PUBLIC_GLADIA_API}`,
                'Content-Type': "application/json"
            },
            method: 'POST',
            body: JSON.stringify({
                "audio_url": uploadData["audio_url"]
            })
        });
        if (!response.ok) {
            console.error("Error sending audio to Gladia:", response.body);
            return null;
        }

        const data = await response.json();
        const id: string = data["id"];
        const resultUrl: string = data["result_url"];

        const {transcript, language} = await pollGladiaTranscript(id, resultUrl);
        if (!transcript) {
            console.error("Error fetching Gladia transcript");
            return null;
        }

        await deleteFromGladia(id);

        return {
            language,
            transcript
        };
    }

    if (provider === "openai") {
        console.log("Sending audio to OpenAI:", uri);

        const formData = new FormData();
        formData.append("file", {
            uri: uri,
            name: "audio.m4a",
            type: "audio/m4a"
        } as any);

        const response = await fetch("https://uni-api.lockie.dev/transcript", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${session?.access_token}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData
        });
        const payload = decode(await response.arrayBuffer());
        if (!response.ok) {
            console.error("Error sending audio to Uni Transcription:", _.get(payload, "error.message", "Unknown error"));
            return null;
        }

        const transcript: string = _.get(payload, "transcript", "");

        return {
            language: "unknown",
            transcript
        };
    }

    return null;
}

