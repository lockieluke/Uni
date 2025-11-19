/// <reference lib="dom" />
/// <reference types="@cloudflare/workers-types" />

import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { timing } from "hono/timing";
import type { THono } from "./lib/types";
import contextRouter from "./routes/context";
import languagesRouter from "./routes/languages";
import translateRouter from "./routes/translate";
import userRouter from "./routes/user";

dayjs.extend(relativeTime);

const app = new Hono<THono>();

app.use(timing());

app.use("/*", async (c, next) => {
	if (c.req.path === "/user/create") return next();

	return bearerAuth({
		async verifyToken(token, c) {
			const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
				global: {
					headers: {
						Authorization: `Bearer ${token}`
					}
				}
			});
			const {
				data: { user },
				error
			} = await supabase.auth.getUser();
			if (error) {
				console.error("Error verifying token:", error.message);
				return false;
			}

			c.set("supabase", supabase);

			if (user) c.set("user", user);

			return !!user && !error;
		}
	})(c, next);
});

app.route("/context", contextRouter);
app.route("/languages", languagesRouter);
app.route("/translate", translateRouter);
app.route("/user", userRouter);

export default app;
