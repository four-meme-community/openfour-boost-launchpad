/**
 * GET /v1/config — public site branding + switchable chains.
 *
 * Purpose: frontend loads name / theme / chain switcher list at boot.
 * Security: response deliberately omits MEME_API_KEY, upstream URLs, etc.
 */
import { Hono } from "hono";
import { publicSiteConfig } from "../config/env.js";
import type { AppVariables } from "../middleware/error-handler.js";

export const configRoutes = new Hono<{ Variables: AppVariables }>();

configRoutes.get("/", (c) =>
	c.json({
		ok: true,
		data: publicSiteConfig(),
		requestId: c.get("requestId"),
	}),
);
