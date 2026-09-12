/**
 * Outbound client for meme-web / partner APIs.
 *
 * Auth (per product rules):
 * - `/meme-api/api/v1/**`: inject `meme-api-key` only
 * - No RSA / meme-api-timestamp / meme-api-secret
 * - Do not call `POST .../token/login/record`
 * - Official-site Web paths: inject apiKey and forward `meme-web-access` (OpenFour create)
 */
import { env } from "../config/env.js";
import { REQUEST_ID_HEADER } from "../middleware/request-id.js";

const FORWARD_REQUEST_HEADERS = new Set([
	"content-type",
	"accept",
	"accept-language",
	"meme-web-access",
	"cookie",
]);

const STRIP_RESPONSE_HEADERS = new Set([
	"connection",
	// Node fetch auto-decompresses gzip/br; do not forward original encoding or compressed Content-Length.
	"content-encoding",
	"content-length",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailers",
	"transfer-encoding",
	"upgrade",
	"set-cookie",
]);

export type UpstreamFetchInit = {
	method: string;
	path: string;
	query?: string;
	/** Raw request body; preserve multipart/image binary bytes. */
	body?: ArrayBuffer | string | null;
	incomingHeaders: Headers;
	requestId: string;
};

export class UpstreamError extends Error {
	constructor(
		message: string,
		readonly status = 502,
	) {
		super(message);
		this.name = "UpstreamError";
	}
}

function buildUpstreamHeaders(
	incoming: Headers,
	requestId: string,
): Headers {
	const out = new Headers();

	for (const [key, value] of incoming.entries()) {
		const lower = key.toLowerCase();
		if (FORWARD_REQUEST_HEADERS.has(lower)) {
			out.set(key, value);
		}
	}

	// SECURITY: server-forced injection; ignore client forgeries
	out.set("meme-api-key", env.MEME_API_KEY);
	out.delete("meme-api-public-key");
	out.delete("meme-api-secret");
	out.delete("meme-api-timestamp");
	out.delete("x-tenant-id");
	out.delete("x-launchpad-id");
	out.set(REQUEST_ID_HEADER, requestId);

	return out;
}

export async function fetchMemeWeb(
	init: UpstreamFetchInit,
): Promise<Response> {
	const target = joinUrl(env.MEME_WEB_BASE_URL, init.path, init.query);
	const isBodyless = init.method === "GET" || init.method === "HEAD";

	const controller = new AbortController();
	const timer = setTimeout(
		() => controller.abort(),
		env.MEME_WEB_TIMEOUT_MS,
	);

	try {
		const headers = buildUpstreamHeaders(
			init.incomingHeaders,
			init.requestId,
		);

		const res = await fetch(target, {
			method: init.method,
			headers,
			body: isBodyless ? undefined : init.body,
			signal: controller.signal,
			redirect: "manual",
		});
		return res;
	} catch (err) {
		if (err instanceof UpstreamError) throw err;
		if (err instanceof Error && err.name === "AbortError") {
			throw new UpstreamError("Upstream timeout", 504);
		}
		throw new UpstreamError(
			err instanceof Error ? err.message : "Upstream fetch failed",
			502,
		);
	} finally {
		clearTimeout(timer);
	}
}

export function filterUpstreamResponseHeaders(upstream: Headers): Headers {
	const out = new Headers();
	for (const [key, value] of upstream.entries()) {
		if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
		out.set(key, value);
	}
	return out;
}

function joinUrl(base: string, path: string, query?: string): string {
	const origin = base.replace(/\/$/, "");
	const p = path.startsWith("/") ? path : `/${path}`;
	return query ? `${origin}${p}?${query}` : `${origin}${p}`;
}
