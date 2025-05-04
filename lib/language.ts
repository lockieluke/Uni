import {openrouter} from "@/lib/ai";

export async function detectLanguageAI(phase: string, hints: string[]) {
    const response = await openrouter({
        model: "qwen/qwen3-30b-a3b",
        messages: [{
            role: "system",
            content: `You are a language detection AI. You will be given a text and you will return the language of the text in ISO 639-1 format.  For example, "en" for English, "fr" for French, "es" for Spanish`,
        }, {
            role: "user",
            content: phase
        }],
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "result",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        language: {
                            type: "string",
                            description: `The language of the text in ISO 639-1 format, they must be either ${hints.join(" or ")}.`
                        }
                    },
                    required: ["language"],
                    additionalProperties: false
                }
            }
        }
    });
    const json = await response.json();
    if (!response.ok || json["error"]) {
        console.error("Error detecting language:", json);
        throw new Error("Error detecting language");
    }

    const payload = JSON.parse(json.choices[0].message.content);
    const language: string = payload.language;

    return language ?? null;
}

export default async function translatePhase(phase: string, source: string, target: string) {
    const response = await openrouter({
        model: "google/gemini-2.5-flash-preview",
        messages: [{
            role: "system",
            content: `You are a translation AI. You will be given a text and you will return the translation of the text in the target language.  For example, "en" for English, "fr" for French, "es" for Spanish.  When "zh-HK" is the target language, please translate it to Spoken Cantonese written in Traditional Chinese characters.`
        }, {
            role: "user",
            content: `Translate the following text from ${source} to ${target}: ${phase}`
        }],
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "result",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        translation: {
                            type: "string"
                        }
                    },
                    required: ["translation"],
                    additionalProperties: false
                }
            }
        }
    });
    const json = await response.json();
    if (!response.ok || json["error"]) {
        console.error("Error translating phase:", json);
        throw new Error("Error translating phase");
    }

    const payload = JSON.parse(json.choices[0].message.content);
    const translation: string = payload.translation;
    return translation ?? null;
}
