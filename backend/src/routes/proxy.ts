/**
 * /v1/proxy/* — restricted reverse proxy.
 *
 * - Partner `/meme-api/api/v1/*`: inject meme-api-key only
 * - Official-site Web `/meme-api/v1/private/*` etc.: inject apiKey + forward meme-web-access
 * - No RSA; reject token/login/record
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
	fetchMemeWeb,
	filterUpstreamResponseHeaders,
	UpstreamError,
} from "../lib/meme-web-client.js";
import {
	isProxyPathAllowed,
	normalizeProxyPath,
} from "../lib/path-allowlist.js";
import type { AppVariables } from "../middleware/error-handler.js";

export const proxyRoutes = new Hono<{ Variables: AppVariables }>();

proxyRoutes.all("/*", async (c) => {
	const wildcard = c.req.path.replace(/^\/v1\/proxy/, "") || "/";
	const path = normalizeProxyPath(wildcard);

	if (!path || !isProxyPathAllowed(path)) {
		throw new HTTPException(403, {
			message: "Proxy path not allowed",
		});
	}

	const url = new URL(c.req.url);
	const body =
		c.req.method === "GET" || c.req.method === "HEAD"
			? null
			: await c.req.arrayBuffer();

	try {
		const upstream = await fetchMemeWeb({
			method: c.req.method,
			path,
			query: url.search ? url.search.slice(1) : undefined,
			body,
			incomingHeaders: c.req.raw.headers,
			requestId: c.get("requestId"),
		});

		const headers = filterUpstreamResponseHeaders(upstream.headers);
		headers.set("x-request-id", c.get("requestId"));

		return new Response(upstream.body, {
			status: upstream.status,
			headers,
		});
	} catch (err) {
		if (err instanceof UpstreamError) {
			throw new HTTPException(err.status as 500 | 502 | 504, {
				message: err.message,
			});
		}
		throw err;
	}
});
