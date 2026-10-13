/**
 * Cross-chain selection.
 *
 * Switchable chains come from BFF `/v1/config`. Encoding:
 * - URL path always uses each chain's `query` as the first segment
 *   e.g. `/bsc/token/0x…`, `/robinhood/token/0x…`
 * - Header / cookie `meme-network-code` uses each chain's `code` (BSC=0, Robinhood=8)
 * - Legacy `?chain=` / bare routes are redirected to the path form by middleware
 */
import Cookies from "js-cookie";
import {
	getAppRoutePath,
	isChainPathQuery,
	parseChainQueryFromPath,
} from "@/i18n/locale-path";
import {
	getConfiguredChains,
	getDefaultPublicChain,
	getPublicChainByCode,
	getPublicChainByQuery,
	type PublicChain,
} from "./chain-config";

export const MEME_NETWORK_COOKIE = "meme-network-code";
export const MEME_NETWORK_HEADER = "meme-network-code";
/** @deprecated Prefer path segment; kept for legacy query redirects. */
export const MEME_NETWORK_QUERY = "chain";

export const MEME_NETWORK_CODE = {
	BSC: "0",
	ROBINHOOD: "8",
} as const;

export const MEME_NETWORK_ID = {
	BSC: "bsc",
	ROBINHOOD: "robinhood",
} as const;

export type MemeNetworkCode = string;
export type MemeNetworkId = PublicChain["id"];

export type MemeNetworkOption = {
	key: string;
	id: MemeNetworkId;
	code: MemeNetworkCode;
	label: string;
	chainId: number;
	query: string;
};

export function getMemeNetworks(): MemeNetworkOption[] {
	return getConfiguredChains();
}

export function normalizeMemeNetworkCode(
	value?: string | number | null,
): MemeNetworkCode {
	const raw = String(value ?? "").trim();
	const match = getConfiguredChains().find(
		(item) => item.code === raw || item.key === raw || item.id === raw,
	);
	return match?.code ?? getDefaultPublicChain().code;
}

export function isRobinhoodNetwork(
	code?: string | number | null,
): boolean {
	return getPublicChainByCode(normalizeMemeNetworkCode(code)).id === "robinhood";
}

export function getMemeNetworkByCode(
	code?: string | number | null,
): MemeNetworkOption {
	return getPublicChainByCode(normalizeMemeNetworkCode(code));
}

export function parseMemeNetworkIdFromQuery(
	value?: string | null,
): MemeNetworkId {
	return getPublicChainByQuery(value).id;
}

export function getMemeNetworkCodeFromQuery(
	value?: string | null,
): MemeNetworkCode {
	if (value == null || String(value).trim() === "") {
		return getDefaultPublicChain().code;
	}
	const raw = String(value).trim().toLowerCase();
	const chain = getPublicChainByQuery(value);
	const enabled = getConfiguredChains().some(
		(item) =>
			item.query === raw || item.id === raw || item.key === raw,
	);
	return enabled ? chain.code : getDefaultPublicChain().code;
}

export function getMemeNetworkQueryValue(
	code?: string | number | null,
): string {
	return getPublicChainByCode(normalizeMemeNetworkCode(code)).query;
}

export function getNativeQuoteSymbol(
	code?: string | number | null,
): PublicChain["nativeSymbol"] {
	return getPublicChainByCode(normalizeMemeNetworkCode(code)).nativeSymbol;
}

/**
 * Whether `symbol` is this chain's native settlement ticker (BFF `nativeSymbol`:
 * BSC=BNB, Robinhood=ETH). Not the meme-api quote row's `nativeSymbol` (e.g. RETH→ETH).
 */
export function isNativeQuoteSymbol(
	symbol?: string | null,
	code?: string | number | null,
): boolean {
	if (!symbol) return false;
	return (
		String(symbol).toUpperCase() ===
		getNativeQuoteSymbol(code ?? getClientMemeNetworkCode()).toUpperCase()
	);
}

export function parseMemeNetworkCodeFromCookieHeader(
	cookieHeader?: string,
): MemeNetworkCode {
	if (!cookieHeader) return getDefaultPublicChain().code;
	const match = String(cookieHeader).match(
		/(?:^|;\s*)meme-network-code=([^;]*)/,
	);
	if (!match?.[1]) return getDefaultPublicChain().code;
	try {
		return normalizeMemeNetworkCode(decodeURIComponent(match[1]));
	} catch {
		return getDefaultPublicChain().code;
	}
}

/** Client: path chain segment first; then cookie. */
export function getClientMemeNetworkCode(): MemeNetworkCode {
	if (typeof window !== "undefined") {
		const fromPath = parseChainQueryFromPath(window.location.pathname);
		if (fromPath) return getMemeNetworkCodeFromQuery(fromPath);
		const fromQuery = new URLSearchParams(window.location.search).get(
			MEME_NETWORK_QUERY,
		);
		if (fromQuery) return getMemeNetworkCodeFromQuery(fromQuery);
		return parseMemeNetworkCodeFromCookieHeader(document.cookie);
	}
	return normalizeMemeNetworkCode(Cookies.get(MEME_NETWORK_COOKIE));
}

export function setClientMemeNetworkCode(code: string | number) {
	Cookies.set(MEME_NETWORK_COOKIE, normalizeMemeNetworkCode(code), {
		expires: 365,
		path: "/",
		sameSite: "lax",
	});
}

/**
 * Prefix path with `/{chainQuery}` (always, including `bsc`).
 */
export function withMemeNetworkPath(
	href: string,
	code?: string | number,
): string {
	if (!href || /^(mailto:|tel:|sms:|#|https?:|\/\/)/i.test(href)) return href;

	const chain = getPublicChainByCode(code ?? getClientMemeNetworkCode());
	const chainQuery = isChainPathQuery(chain.query)
		? chain.query
		: getDefaultPublicChain().query;

	const hashIndex = href.indexOf("#");
	const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
	const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
	const qIndex = withoutHash.indexOf("?");
	const rawPath = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
	const search = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : "";

	const routePath = getAppRoutePath(rawPath);
	const params = new URLSearchParams(search);
	params.delete(MEME_NETWORK_QUERY);
	const query = params.toString();

	const prefixed =
		routePath === "/" ? `/${chainQuery}` : `/${chainQuery}${routePath}`;

	return query ? `${prefixed}?${query}${hash}` : `${prefixed}${hash}`;
}

/** @deprecated Use `withMemeNetworkPath`. */
export function withMemeNetworkQuery(
	href: string,
	code?: string | number,
): string {
	return withMemeNetworkPath(href, code);
}

export function goHomeAndReload(code?: string | number) {
	const chain = getPublicChainByCode(code ?? getClientMemeNetworkCode());
	const chainQuery = isChainPathQuery(chain.query)
		? chain.query
		: getDefaultPublicChain().query;
	const homeUrl = `/${chainQuery}`;
	const currentUrl = `${window.location.pathname}${window.location.search}`;
	if (currentUrl === homeUrl || currentUrl === `${homeUrl}/`) {
		window.location.reload();
		return;
	}
	window.location.replace(homeUrl);
}
