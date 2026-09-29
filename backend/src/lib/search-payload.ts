/**
 * Inject filterByPartner into partner token/search bodies when enabled.
 */
import { env } from "../config/env.js";

const TOKEN_SEARCH_PATH = "/meme-api/api/v1/public/token/search";

export function isTokenSearchPath(path: string): boolean {
	const normalized = path.replace(/\/+$/, "") || path;
	return normalized === TOKEN_SEARCH_PATH;
}

/** When FILTER_BY_PARTNER is on, force filterByPartner:true (uses header meme-api-key). */
export function rewriteTokenSearchBody(
	path: string,
	raw: ArrayBuffer | string | null,
): ArrayBuffer | string | null {
	if (!raw || !env.FILTER_BY_PARTNER || !isTokenSearchPath(path)) return raw;

	const text =
		typeof raw === "string" ? raw : new TextDecoder().decode(raw);
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return raw;
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return raw;
	}

	const next = {
		...(parsed as Record<string, unknown>),
		filterByPartner: true,
	};
	return JSON.stringify(next);
}
