/// <reference types="bun" />

import { decode } from "@msgpack/msgpack";

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_DEVELOPMENT = NODE_ENV === 'development';
const PROVIDER = process.env.PROVIDER || 'openai';
const JWT = process.env.JWT;
if (!JWT && !IS_DEVELOPMENT)
    throw new Error("JWT is not set. Please set the JWT environment variable.");

const audioFilePath = Bun.argv[2];
if (!audioFilePath) {
    throw new Error("Please provide an audio file path as an argument: bun transcript.mts /path/to/audio/file.mp3");
}

const file = Bun.file(audioFilePath);
if (!(await file.exists()))
    throw new Error(`File ${audioFilePath} does not exist`);

const formData = new FormData();
formData.append('file', file);

const response = await fetch(`${IS_DEVELOPMENT ? "http://localhost:8787" : "https://uni-api.lockie.dev"}/transcript?provider=${PROVIDER}`, {
    method: "POST",
    headers: {
        "Authorization": `Bearer ${JWT}`
    },
    body: formData
});

const json: any = decode(await response.arrayBuffer());
if (!response.ok)
    throw new Error(`Error: ${json.error.message}`);

const { transcript } = json;

console.log("Transcript received from API:", transcript);