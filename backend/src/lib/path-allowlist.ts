/**
 * Upstream path allowlist (dual channel).
 *
 * 1) Partner public API: `/meme-api/api/v1/**`
 *    - Inject meme-api-key only
 *    - Reject login/record (even the non-RSA variant)
 *
 * 2) Official-site Web API (same as meme-launcher): user-session capabilities
 *    - Login / profile / invite rebate / OpenFour create
 *    - Forward meme-web-access + inject apiKey
 */
export const MEME_WEB_PROXY_PREFIXES = [
	/** Partner public and read-only capabilities */
	"/meme-api/api/v1/",

	/** Login, profile, holdings, tax claim — user session */
	"/meme-api/v1/private/user/",

	/** Invite rebate: query / bind code / claim */
	"/meme-api/v1/private/invite",

	/** Airdrop claim (when product enables it) */
	"/meme-api/v1/private/airdrop",

	/** OpenFour create and template config (docs appendix / same as launcher) */
	"/meme-api/v1/private/token_template/",
	"/meme-api/v1/public/token_template/",

	/** Post-create poll for indexing + detail fallback */
	"/meme-api/v1/private/token/",

	/** Official-site public helpers (e.g. image CDN host) */
	"/meme-api/v1/public/file/",
	"/meme-api/v1/public/ticker",

	/** Public quote-token config (includes logoUrl) */
	"/meme-api/v1/public/config",

	/** Official-site contract addresses (e.g. RebateKeeper for rebate claims) */
	"/meme-api/v1/public/address",

	/** Candles: bonding / DEX historical bars (Lightweight Charts datafeed) */
	"/meme-api/v1/public/bar",
] as const;

const DENIED_EXACT = ["/meme-api/api/v1/token/login/record"] as const;

export function normalizeProxyPath(raw: string): string | null {
	if (!raw || typeof raw !== "string") return null;

	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || raw.startsWith("//")) {
		return null;
	}
	if (raw.includes("\\") || raw.includes("\0")) return null;

	let path = raw.startsWith("/") ? raw : `/${raw}`;
	path = path.replace(/\/{2,}/g, "/");

	if (path.split("/").includes("..")) return null;

	return path;
}

export function isProxyPathAllowed(path: string): boolean {
	const normalized = path.replace(/\/+$/, "") || path;
	if (DENIED_EXACT.some((p) => normalized === p)) return false;

	return MEME_WEB_PROXY_PREFIXES.some((prefix) => {
		if (prefix.endsWith("/")) {
			return path === prefix.slice(0, -1) || path.startsWith(prefix);
		}
		// No trailing slash: exact match or subpath
		return path === prefix || path.startsWith(`${prefix}/`);
	});
}
