/**
 * Process entry: load env → create app → listen.
 * Local: pnpm dev | Prod: node dist/index.js
 */
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

serve(
	{
		fetch: app.fetch,
		port: env.PORT,
		hostname: env.HOST,
	},
	(info) => {
		console.log(
			JSON.stringify({
				level: "info",
				msg: "listening",
				host: env.HOST,
				port: info.port,
				env: env.NODE_ENV,
			}),
		);
	},
);
