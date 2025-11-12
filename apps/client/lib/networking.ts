import { decode } from "@msgpack/msgpack";
import axios from "axios";
import * as _ from "radashi";
import { supabase } from "./supabase";
import { mmkvStorage } from "./storage";

export const UNI_API_BASE_URL = mmkvStorage.getBool("useDevServer") && __DEV__ ? mmkvStorage.getString("devServerUrl") ?? "http://127.0.0.1:8787" : "https://uni-api.lockie.dev";

const uniApi = axios.create({
  baseURL: UNI_API_BASE_URL,
  headers: {
    "Content-Type": "application/x-msgpack",
    "User-Agent": "Uni/1.0.0"
  },
  timeout: 10 * 1000,
  adapter: "fetch",
  responseType: "arraybuffer",
  transformRequest: [data => {
    return data;
  }],
  transformResponse: [data => {
    if (data instanceof ArrayBuffer) {
      const [err, payload] = _.tryit(decode)(data);
      if (err) {
        const text = new TextDecoder().decode(data);
        throw new Error(`Error decoding response from Uni API with payload ${text}: ${err.message}`);
      }

      if (!_.isPlainObject(payload))
        throw new Error("Invalid response from Uni API: not a plain object");

      return payload;
    }

    return data;
  }]
});

uniApi.interceptors.request.use(async config => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error)
    throw new Error("Error getting session when fetching from Uni API");

  config.headers["Authorization"] = `Bearer ${session?.access_token}`;

  return config;
});

export { uniApi };
