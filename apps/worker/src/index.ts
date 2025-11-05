/// <reference lib="dom" />
/// <reference types="@cloudflare/workers-types" />

import { decode } from '@msgpack/msgpack';
import { createClient } from '@supabase/supabase-js';
import { OpenAITranscriptionModelSchema, TranscriptionProviderSchema, TranslationLLMMPropertySchema, UniTiers } from "@uni/api";
import { generateObject } from "ai";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from "http-status-codes";
import * as async from "modern-async";
import * as _ from "radashi";
import { z } from "zod/v4";
import { groq, openai, transcriptionModel, translationModel, useOpenRouter } from "./ai";
import { LanguageSchema, translateSchema } from "./schemas";
import { THono } from './types';
import { getUsage, incrementUsage, monthlyLimit } from './usage';
import userRouter, { getTier } from './user';
import { withMsgpack } from './utils';

dayjs.extend(relativeTime);

const app = new Hono<THono>();

app.onError(async (err, c) => {
  if (err instanceof HTTPException) {
    const contentType = err.res?.headers.get("Content-Type") ?? "text/plain;charset=UTF-8";
    if (contentType === "text/plain;charset=UTF-8") {
      const message = await err.res?.text() ?? "An unexpected error occurred";

      c.status(err.status);

      return withMsgpack({
        error: {
          message,
          http_code: err.status,
          stack: c.env.DEV ? err.stack || "No stack trace available" : undefined
        }
      }, c);
    }
    return err.getResponse();
  }

  throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
    res: withMsgpack({
      error: {
        message: err.message || "An unexpected error occurred",
        http_code: StatusCodes.INTERNAL_SERVER_ERROR,
        stack: c.env.DEV ? err.stack || "No stack trace available" : undefined
      }
    }, c)
  });
});

app.use("/transcript", async (c, next) => {
  await next();
  await incrementUsage(c, "speech_translation");
});

app.use("/*", async (c, next) => {
  if (c.req.path === "/user/create")
    return next();

  return bearerAuth({
    async verifyToken(token, c) {
      const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error verifying token:", error.message);
        return false;
      }

      c.set("supabase", supabase);

      if (user)
        c.set("user", user);

      return !!user && !error;
    },
  })(c, next);
});

app.post("/transcript", async (c) => {
  const formData = await c.req.parseBody();
  if (!formData) {
    throw new HTTPException(StatusCodes.BAD_REQUEST, {
      res: withMsgpack({
        error: {
          message: "No form data found"
        }
      }, c)
    });
  }

  const usage = await getUsage(c, "speech_translation");
  const tier = await getTier(c);
  if (usage >= monthlyLimit["speech_translation"][_.invert(UniTiers)[tier]])
    throw new HTTPException(StatusCodes.FORBIDDEN, {
      res: withMsgpack({
        error: {
          message: `Monthly limit reached for speech translation on tier ${tier}`
        }
      }, c)
    });

  const file = formData["file"];
  if (!file || !(file instanceof File)) {
    throw new HTTPException(StatusCodes.BAD_REQUEST, {
      res: withMsgpack({
        error: {
          message: "No file found"
        }
      }, c)
    });
  }

  const { data: provider, success } = await TranscriptionProviderSchema.safeParseAsync(c.req.query("provider") || "openai");
  if (!success)
    throw new HTTPException(StatusCodes.BAD_REQUEST, {
      res: withMsgpack({
        error: {
          message: `Invalid provider "${provider}"`,
        }
      }, c)
    });

  const transcriptStart = dayjs();

  if (provider === "groq") {
    try {
      const { text } = await groq.audio.transcriptions.create({
        file,
        model: "whisper-large-v3-turbo",
        prompt: "When transcribing audio in Cantonese, please use the Cantonese dialect",
        response_format: "json",
        temperature: 0
      });
      const transcriptTiming = dayjs().diff(transcriptStart, "millisecond");
      if (c.env.DEV)
        console.log(`Transcribing file ${file.name} took ${transcriptTiming}ms`);

      return withMsgpack({
        transcript: text,
        timing: transcriptTiming
      }, c);
    } catch (error) {
      console.error("Error during transcription:", error);
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        res: withMsgpack({
          error: {
            message: error instanceof Error ? error.message : "An error occurred during transcription"
          }
        }, c)
      });
    }
  }

  if (provider === "openai") {
    const { data: mode, error, success } = await OpenAITranscriptionModelSchema.safeParseAsync(c.req.query("mode") ?? "fast");
    if (!success || !mode)
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        res: withMsgpack({
          error: {
            message: `Invalid mode "${mode}": ${error?.message}`,
          }
        }, c)
      });

    const { text } = await openai.audio.transcriptions.create({
      file,
      model: transcriptionModel[mode],
      response_format: "json",
      temperature: 0
    });

    const transcriptTiming = dayjs().diff(transcriptStart, "millisecond");
    if (c.env.DEV)
      console.log(`Transcribing file ${file.name} took ${transcriptTiming}ms`);

    if (!text) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        res: withMsgpack({
          error: {
            message: "No text found in response"
          }
        }, c)
      });
    }

    return withMsgpack({
      transcript: text,
      timing: transcriptTiming
    }, c);
  }

  return withMsgpack({

  }, c);
});

app.post("/translate", async (c) => {
  const payload = decode(await c.req.arrayBuffer());
  const reqBody = await translateSchema.safeParseAsync(payload);
  if (!reqBody.success) {
    throw new HTTPException(StatusCodes.BAD_REQUEST, {
      res: withMsgpack({
        error: {
          message: reqBody.error.message
        }
      }, c)
    });
  }

  const { phrase, hints } = reqBody.data;
  const { data: mode, success } = await TranslationLLMMPropertySchema.safeParseAsync(c.req.query("mode") || "default");
  if (!success)
    throw new HTTPException(StatusCodes.BAD_REQUEST, {
      res: withMsgpack({
        error: {
          message: `Invalid mode "${mode}"`,
        }
      }, c)
    });

  const translateTiming = performance.now();

  try {
    const { object, finishReason, response } = await generateObject({
      model: useOpenRouter(translationModel[mode]),
      messages: [{
        role: "system",
        content: `
You are given a phrase.  This phrase could be in the languages represented by these language codes: ${hints.join(", ")}
1. Detect the source language of the phrase.
2. Identify the target language as the other code in the pair.
3. Translate the phrase into the target language, when "zh-HK" is specified, please translate to Spoken Cantonese.  Please note that some English phrases may be used when Cantonese is the source language, presrve the original English phrases when translating.
4. In your response, include the source language code, the target language code, and the translated phrase.
Do not interpret the phrase, just translate it.
            `.trim()
      }, {
        role: "user",
        content: `Phrase is "${phrase}"`
      }],
      schema: z.object({
        pretranslatedPhrase: z.string().describe("The phrase before translation"),
        translatedPhrase: z.string().describe("The phrase after translation"),
        sourceLanguage: z.string(),
        targetLanguage: z.string()
      }),
      temperature: 0,
      providerOptions: {
        openrouter: mode === "default" ? {
          provider: {
            only: ["google-ai-studio"]
          }
        } : (mode === "fast" ? {
          provider: {
            only: ["cerebras"]
          }
        } : {})
      }
    });

    if (c.env.DEV)
      console.log(`Translating phrase ${phrase} to ${object.targetLanguage} took ${performance.now() - translateTiming}ms`);

    const additionalData = {
      ..._.pick(response, ["id", "modelId", "timestamp"]),
    };

    if (finishReason === "error") {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        res: withMsgpack({
          error: {
            message: "Error in translation"
          }
        }, c)
      });
    }

    if (!(hints.includes(object.sourceLanguage) && hints.includes(object.targetLanguage))) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        res: withMsgpack({
          error: {
            message: `Failed to translate, model returned "${object.sourceLanguage}" and "${object.targetLanguage}" but hints were "${hints.join(", ")}"`,
          }
        }, c)
      });
    }

    return withMsgpack({
      ...object,
      ...additionalData
    }, c);
  } catch (error) {
    console.error("Translation error:", error);
    throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
      res: withMsgpack({
        error: {
          message: error instanceof Error ? error.message : "An error occurred during translation"
        }
      }, c)
    });
  }
});

app.get("/languages", async c => {
  let languages: {
    [key: string]: z.infer<typeof LanguageSchema>
  } = {};

  const supabase = c.get("supabase");
  const { data, error } = await supabase.from("languages").select("*");
  if (error)
    throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
      res: withMsgpack({
        error: {
          message: `Error fetching languages: ${error.message}`,
        }
      }, c)
    });

  if (!data) {
    throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
      res: withMsgpack({
        error: {
          message: "No languages found",
        }
      }, c)
    });
  }

  await async.asyncForEach(data, async lang => {
    const { success, data: parsedLang, error } = await LanguageSchema.safeParseAsync(_.mapKeys(_.shake(lang, v => _.isNullish(v)), (key: string) => _.camel(key)));
    if (!success) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        res: withMsgpack({
          error: {
            message: `Error parsing language "${lang.lang}": ${error?.message}`,
          }
        }, c)
      });
    }

    if (parsedLang)
      languages[lang.lang] = parsedLang;
  });

  return withMsgpack({
    languages
  }, c);
});

app.route("/user", userRouter);

export default app;
