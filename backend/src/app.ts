/**
 * Assemble the Hono app: middleware order + route mounts.
 *
 * Layering (outside → inside):
 * 1. requestId / accessLog / CORS / security headers
 * 2. /v1/* business routes
 * 3. unified errorHandler
 *
 * No business logic here — easy to inject via `createApp()` in unit tests.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { corsOriginList, env } from "./config/env.js";
import { accessLogMiddleware } from "./middleware/access-log.js";
import {
	errorHandler,
	type AppVariables,
} from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { configRoutes } from "./routes/config.js";
import { healthRoutes } from "./routes/health.js";
import { proxyRoutes } from "./routes/proxy.js";
import { streamRoutes } from "./routes/stream.js";
import { tokensRoutes } from "./routes/tokens.js";

export function createApp() {
	const app = new Hono<{ Variables: AppVariables }>();

	app.onError(errorHandler);

	app.use("*", requestIdMiddleware);
	app.use("*", accessLogMiddleware);
	// API BFF: default security headers; page CSP is owned by the frontend
	app.use("*", secureHeaders());

	const origins = corsOriginList();
	app.use(
		"*",
		cors({
			origin: (origin) => {
				if (!origin) return origins[0] ?? "";
				// SECURITY: exact-match allowlist only; no *
				return origins.includes(origin) ? origin : "";
			},
			credentials: true,
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowHeaders: [
				"Content-Type",
				"Accept",
				"meme-web-access",
				"X-Request-Id",
			],
			exposeHeaders: ["X-Request-Id"],
			maxAge: 600,
		}),
	);

	app.route("/v1/health", healthRoutes);
	app.route("/v1/config", configRoutes);
	app.route("/v1/proxy", proxyRoutes);
	app.route("/v1/tokens", tokensRoutes);
	app.route("/v1/stream", streamRoutes);

	app.get("/", (c) =>
		c.json({
			ok: true,
			service: "openfour-launchpad-bff",
			env: env.NODE_ENV,
			docs: {
				health: "/v1/health",
				config: "/v1/config",
				proxy: "/v1/proxy/*",
				tokens: "/v1/tokens",
				streamBars: "/v1/stream/bars?tokenId=&typeEnum=MIN5",
				streamFills: "/v1/stream/fills?tokenId=",
				streamHub: "/v1/stream/hub",
			},
		}),
	);

	app.notFound((c) =>
		c.json(
			{
				ok: false,
				error: {
					code: "not_found",
					message: "Not found",
					requestId: c.get("requestId"),
				},
			},
			404,
		),
	);

	return app;
}

export type App = ReturnType<typeof createApp>;
