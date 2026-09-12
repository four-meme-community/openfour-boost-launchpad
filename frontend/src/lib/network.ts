/**
 * Cross-chain selection (aligned with meme-launcher).
 *
 * Switchable chains come from BFF `/v1/config`. Encoding stays:
 * - URL `?chain=` uses each chain's `query` (omitted for the default chain)
 * - Header `meme-network-code` uses each chain's `code` (BSC=0, Robinhood=8)
 */
import Cookies from "js-cookie";
import {
	getConfiguredChains,
	getDefaultPublicChain,
	getPublicChainByCode,
	getPublicChainByQuery,
	type PublicChain,
} from "./chain-config";

export const MEME_NETWORK_COOKIE = "meme-network-code";
export const MEME_NETWORK_HEADER = "meme-network-code";
export const MEME_NETWORK_QUERY = "chain";

export const MEME_NETWORK_CODE = {
	BSC: "0",
	ROBINHOOD: "8",
} as const;

export const MEME_NETWORK_ID = {
	BSC: "bsc",
	ROBINHOOD: "robinhood",
} as const;

export const WALLET_NETWORK_CODE = {
	BSC: "BSC",
	ROBINHOOD: "ROBINHOOD",
} as const;

export type MemeNetworkCode = string;
export type MemeNetworkId = PublicChain["id"];
export type WalletNetworkCode = PublicChain["walletNetworkCode"];

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
	const chain = getPublicChainByQuery(value);
	const enabled = getConfiguredChains().some(
		(item) =>
			item.query === String(value).trim().toLowerCase() ||
			item.id === String(value).trim().toLowerCase() ||
			item.key === String(value).trim().toLowerCase(),
	);
	return enabled ? chain.code : getDefaultPublicChain().code;
}

export function getMemeNetworkQueryValue(
	code?: string | number | null,
): string {
	return getPublicChainByCode(normalizeMemeNetworkCode(code)).query;
}

export function getWalletNetworkCode(
	code?: string | number | null,
): WalletNetworkCode {
	return getPublicChainByCode(normalizeMemeNetworkCode(code)).walletNetworkCode;
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

/** Client: URL `?chain=` first; server / no window: cookie. */
export function getClientMemeNetworkCode(): MemeNetworkCode {
	if (typeof window !== "undefined") {
		const raw = new URLSearchParams(window.location.search).get(
			MEME_NETWORK_QUERY,
		);
		return getMemeNetworkCodeFromQuery(raw);
	}
	if (typeof document !== "undefined") {
		return parseMemeNetworkCodeFromCookieHeader(document.cookie);
	}
	return normalizeMemeNetworkCode(Cookies.get(MEME_NETWORK_COOKIE));
}

export function getClientWalletNetworkCode(): WalletNetworkCode {
	return getWalletNetworkCode(getClientMemeNetworkCode());
}

export function setClientMemeNetworkCode(code: string | number) {
	Cookies.set(MEME_NETWORK_COOKIE, normalizeMemeNetworkCode(code), {
		expires: 365,
		path: "/",
		sameSite: "lax",
	});
}

/**
 * Add `?chain=` for a non-default chain. Default chain does not write the query.
 * Existing `chain` is left untouched.
 */
export function withMemeNetworkQuery(
	href: string,
	code?: string | number,
): string {
	if (!href || /^(mailto:|tel:|sms:|#|https?:|\/\/)/i.test(href)) return href;
	const chain = getPublicChainByCode(code ?? getClientMemeNetworkCode());
	const defaultChain = getDefaultPublicChain();
	if (chain.query === defaultChain.query) return href;

	const hashIndex = href.indexOf("#");
	const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
	const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
	const qIndex = withoutHash.indexOf("?");
	const path = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
	const search = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : "";
	const params = new URLSearchParams(search);
	if (!params.has(MEME_NETWORK_QUERY)) {
		params.set(MEME_NETWORK_QUERY, chain.query);
	}
	const query = params.toString();
	return query ? `${path}?${query}${hash}` : `${path}${hash}`;
}

export function goHomeAndReload(code?: string | number) {
	const chain = getPublicChainByCode(code ?? getClientMemeNetworkCode());
	const defaultChain = getDefaultPublicChain();
	const pathname = window.location.pathname || "/";
	const segments = pathname.split("/").filter(Boolean);
	const locale = segments[0] || "en";
	const homePath = `/${locale}`;
	const homeUrl =
		chain.query === defaultChain.query
			? homePath
			: `${homePath}?${MEME_NETWORK_QUERY}=${chain.query}`;
	const currentUrl = `${window.location.pathname}${window.location.search}`;
	if (currentUrl === homeUrl) {
		window.location.reload();
		return;
	}
	window.location.replace(homeUrl);
}
