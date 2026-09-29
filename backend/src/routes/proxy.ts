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
	rewriteCreateTokenBody,
	summarizeCreateTokenBody,
} from "../lib/create-payload.js";
import {
	isProxyPathAllowed,
	normalizeProxyPath,
} from "../lib/path-allowlist.js";
import { rewriteTokenSearchBody } from "../lib/search-payload.js";
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
	const rawBody =
		c.req.method === "GET" || c.req.method === "HEAD"
			? null
			: await c.req.arrayBuffer();
	const body = rewriteTokenSearchBody(
		path,
		rewriteCreateTokenBody(path, rawBody),
	);

	try {
		const incomingHeaders = new Headers(c.req.raw.headers);
		if (typeof body === "string") {
			incomingHeaders.set("content-type", "application/json");
		}

		const upstream = await fetchMemeWeb({
			method: c.req.method,
			path,
			query: url.search ? url.search.slice(1) : undefined,
			body,
			incomingHeaders,
			requestId: c.get("requestId"),
		});

		const headers = filterUpstreamResponseHeaders(upstream.headers);
		headers.set("x-request-id", c.get("requestId"));

		if (upstream.status >= 400) {
			const raw = await upstream.text();
			console.error(
				JSON.stringify({
					level: "error",
					msg: "upstream",
					requestId: c.get("requestId"),
					method: c.req.method,
					path,
					status: upstream.status,
					body: raw.slice(0, 2000),
					create: summarizeCreateTokenBody(body),
				}),
			);
			return new Response(raw, {
				status: upstream.status,
				headers,
			});
		}

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
