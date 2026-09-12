/**
 * GET /v1/health — liveness probe (K8s / Docker).
 * Does not probe upstream — keeps health checks from hammering meme-web.
 */
import { Hono } from "hono";
import type { AppVariables } from "../middleware/error-handler.js";

export const healthRoutes = new Hono<{ Variables: AppVariables }>();

healthRoutes.get("/", (c) =>
	c.json({
		ok: true,
		service: "openfour-launchpad-bff",
		requestId: c.get("requestId"),
	}),
);
