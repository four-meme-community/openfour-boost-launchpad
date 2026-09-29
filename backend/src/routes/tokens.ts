/**
 * GET /v1/tokens — OpenFour list via partner search.
 * Public POST: meme-api-key only (BFF-injected), no RSA.
 *
 * Query:
 * - type: NEW | PROGRESS | DEX | HOT …
 * - listType: TEP | NOR | NOR_DEX …
 * - status: PUBLISH | TRADE | ALL
 * - version: V12 (default)
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "../config/env.js";
import {
	fetchMemeWeb,
	filterUpstreamResponseHeaders,
	UpstreamError,
} from "../lib/meme-web-client.js";
import { normalizeMemeNetworkCode } from "../lib/meme-network.js";
import type { AppVariables } from "../middleware/error-handler.js";

export const tokensRoutes = new Hono<{ Variables: AppVariables }>();

tokensRoutes.get("/", async (c) => {
	const pageIndex = Number(c.req.query("pageIndex") || "1");
	const pageSize = Number(c.req.query("pageSize") || "40");
	const type = c.req.query("type") || "NEW";
	const listType = c.req.query("listType") || "TEP";
	const status = c.req.query("status") || "PUBLISH";
	const version = c.req.query("version") || "V12";
	const keyword = c.req.query("keyword")?.trim() || undefined;
	const templateId = c.req.query("templateId") || undefined;
	const networkCode = normalizeMemeNetworkCode(
		c.req.header("meme-network-code") || c.req.query("networkCode"),
	);

	// keyword must be sent with the current tab filters (type/listType/status), or results
	// escape the selected category (e.g. finding ungraduated tokens under the Graduated tab).
	const body = {
		pageIndex,
		pageSize,
		type,
		listType,
		status,
		version,
		...(keyword ? { keyword } : {}),
		...(templateId ? { templateId: Number(templateId) } : {}),
		...(env.FILTER_BY_PARTNER ? { filterByPartner: true } : {}),
	};

	try {
		const upstream = await fetchMemeWeb({
			method: "POST",
			path: "/meme-api/api/v1/public/token/search",
			body: JSON.stringify(body),
			incomingHeaders: new Headers({
				"content-type": "application/json",
				accept: "application/json",
				"meme-network-code": networkCode,
			}),
			requestId: c.get("requestId"),
		});

		const headers = filterUpstreamResponseHeaders(upstream.headers);
		headers.set("x-request-id", c.get("requestId"));
		headers.set("content-type", "application/json");

		const text = await upstream.text();
		return new Response(text, { status: upstream.status, headers });
	} catch (err) {
		if (err instanceof UpstreamError) {
			throw new HTTPException(err.status as 502 | 504, {
				message: err.message,
			});
		}
		throw err;
	}
});

tokensRoutes.get("/meta", (c) =>
	c.json({
		ok: true,
		data: {
			upstream: "/meme-api/api/v1/public/token/search",
			auth: "meme-api-key only (no RSA)",
			versionFilter: "V12",
			filterByPartner: env.FILTER_BY_PARTNER,
			tabs: {
				new: { type: "NEW", listType: "TEP", status: "PUBLISH" },
				soon: { type: "PROGRESS", listType: "TEP", status: "PUBLISH" },
				graduated: { type: "DEX", listType: "NOR_DEX", status: "TRADE" },
			},
			site: env.SITE_NAME,
		},
		requestId: c.get("requestId"),
	}),
);
