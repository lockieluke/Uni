import { decode } from "@msgpack/msgpack";
import axios from "axios";
import * as _ from "radashi";
import { supabase } from "./supabase";
import { mmkvStorage } from "./storage";

const uniApi = axios.create({
    baseURL: mmkvStorage.getBool("useDevServer") ? "http://127.0.0.1:8787" : "https://uni-api.lockie.dev",
    headers: {
        "Content-Type": "application/x-msgpack",
        "User-Agent": "Uni/1.0.0"
    },
    timeout: 3000,
    adapter: "fetch",
    responseType: "arraybuffer",
    transformResponse: [data => {
        if (data instanceof ArrayBuffer) {
            const payload = decode(data);
            if (!_.isPlainObject(payload))
                throw new Error("Invalid response from Uni API: not a plain object");

            return payload;
        }

        return data;
    }],
    validateStatus: () => true
});

uniApi.interceptors.request.use(async config => {
    const {data: {session}, error} = await supabase.auth.getSession();
    if (error)
        throw new Error("Error getting session when fetching from Uni API");

    config.headers["Authorization"] = `Bearer ${session?.access_token}`;

    return config;
});

export { uniApi };
