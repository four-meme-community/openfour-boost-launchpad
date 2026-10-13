/**
 * meme-web business client (always via BFF /v1/proxy).
 *
 * Security: never attach meme-api-key; session cookie user_token → meme-web-access header.
 */
import Cookies from "js-cookie";
import { toMemeApiNetworkCode } from "./chain";
import { publicEnv } from "./env";
import {
	getClientMemeNetworkCode,
	MEME_NETWORK_HEADER,
} from "./network";

export type MemeResponse<T> = {
	code: number;
	msg: string;
	data: T;
};

const ACCESS_COOKIE = "user_token";

export function getAccessToken(): string | undefined {
	if (typeof window === "undefined") return undefined;
	return Cookies.get(ACCESS_COOKIE);
}

export function setAccessToken(token: string) {
	Cookies.set(ACCESS_COOKIE, token, { expires: 1 });
}

export function clearAccessToken() {
	Cookies.remove(ACCESS_COOKIE);
}

function buildHeaders(init?: HeadersInit): Headers {
	const headers = new Headers(init);
	if (!headers.has("Accept")) headers.set("Accept", "application/json");
	const token = getAccessToken();
	if (token) headers.set("meme-web-access", token);
	// Same as meme-launcher: BSC/testnet → 0, Robinhood/testnet → 8
	headers.set(MEME_NETWORK_HEADER, getClientMemeNetworkCode());
	return headers;
}

async function proxyFetch(
	memePath: string,
	init?: RequestInit,
): Promise<Response> {
	const path = memePath.startsWith("/") ? memePath : `/${memePath}`;
	const url = `${publicEnv.bffUrl}/v1/proxy${path}`;
	return fetch(url, {
		...init,
		credentials: "include",
		headers: buildHeaders(init?.headers),
	});
}

export async function memeJson<T>(
	memePath: string,
	init?: RequestInit,
): Promise<MemeResponse<T>> {
	const res = await proxyFetch(memePath, init);
	const text = await res.text();
	let json: (MemeResponse<T> & { message?: string }) | null = null;
	try {
		json = text ? (JSON.parse(text) as MemeResponse<T> & { message?: string }) : null;
	} catch {
		json = null;
	}
	if (json && json.code != null) {
		return json;
	}
	if (!res.ok) {
		const detail =
			(json && (json.msg || json.message)) ||
			text.replace(/\s+/g, " ").trim().slice(0, 240);
		throw new Error(detail || `HTTP ${res.status}`);
	}
	throw new Error("Invalid API response");
}

export async function memeGet<T>(
	memePath: string,
	query?: Record<string, string | number | undefined>,
): Promise<MemeResponse<T>> {
	const qs = new URLSearchParams();
	if (query) {
		for (const [k, v] of Object.entries(query)) {
			if (v === undefined || v === "") continue;
			qs.set(k, String(v));
		}
	}
	const q = qs.toString();
	return memeJson<T>(q ? `${memePath}?${q}` : memePath);
}

export async function memePost<T>(
	memePath: string,
	body?: unknown,
): Promise<MemeResponse<T>> {
	return memeJson<T>(memePath, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body ?? {}),
	});
}

export type QuoteTicker = {
	symbol: string;
	price: string | number;
};

/** Quote asset USD price; same source as meme-launcher `fetchTickerPrice`. */
export async function fetchQuoteTickerPrice(
	symbol: string,
): Promise<number> {
	const res = await memePost<QuoteTicker[]>(
		"/meme-api/v1/public/ticker",
		{},
	);
	if (res.code !== 0) throw new Error(res.msg || "Ticker price failed");

	const target = symbol.toUpperCase();
	if (target === "USDT") return 1;
	const findPrice = (key: string) => {
		const row = (res.data || []).find(
			(item) =>
				String(item.symbol).toUpperCase().replace(/USDT$/, "") === key,
		);
		const price = Number(row?.price);
		return Number.isFinite(price) && price > 0 ? price : 0;
	};
	const direct = findPrice(target);
	if (direct > 0) return direct;

	// RETH → ETH via public config nativeSymbol
	try {
		const { ensureCommonConfig } = await import("@/hooks/use-common-config");
		const { quoteDisplaySymbol } = await import("@/lib/open-four");
		const common = await ensureCommonConfig();
		const display = quoteDisplaySymbol(symbol, common).toUpperCase();
		if (display && display !== target) {
			const viaNative = findPrice(display);
			if (viaNative > 0) return viaNative;
		}
	} catch {
		// ignore
	}
	return 1;
}

/**
 * Upload token image (same Web API as meme-launcher).
 * Browser sets FormData Content-Type including the multipart boundary.
 */
export async function uploadTokenImage(file: File): Promise<string> {
	const form = new FormData();
	form.append("file", file);

	const res = await proxyFetch("/meme-api/v1/private/token/upload", {
		method: "POST",
		body: form,
	});
	const json = (await res.json()) as MemeResponse<string>;
	if (!res.ok || json.code !== 0 || !json.data) {
		throw new Error(json.msg || `Image upload failed (${res.status})`);
	}
	return json.data;
}

/** Home tabs → partner search params (OpenFour V12) */
export type MarketTab = "new" | "soon" | "graduated";

export function marketTabSearchParams(tab: MarketTab): {
	type: string;
	listType: string;
	status: string;
	version: string;
} {
	if (tab === "soon") {
		return {
			type: "PROGRESS",
			listType: "TEP",
			status: "PUBLISH",
			version: "V12",
		};
	}
	if (tab === "graduated") {
		return {
			type: "DEX",
			listType: "NOR_DEX",
			status: "TRADE",
			version: "V12",
		};
	}
	return {
		type: "NEW",
		listType: "TEP",
		status: "PUBLISH",
		version: "V12",
	};
}

/** Search ranking types supported by partner `token/search` (also used by meme-launcher). */
export type SearchSortType = "NEW" | "VOL" | "CAP" | "HOT" | "GAIN";

/** BFF-aggregated V12 list (new / almost graduated / graduated) */
export async function fetchTokenList(params?: {
	pageIndex?: number;
	pageSize?: number;
	type?: string;
	listType?: string;
	status?: string;
	version?: string;
	sort?: "ASC" | "DESC";
	keyword?: string;
	templateId?: number;
	tab?: MarketTab;
}) {
	const fromTab = params?.tab ? marketTabSearchParams(params.tab) : null;
	const qs = new URLSearchParams();
	qs.set("pageIndex", String(params?.pageIndex ?? 1));
	qs.set("pageSize", String(params?.pageSize ?? 40));
	qs.set("type", params?.type ?? fromTab?.type ?? "HOT");
	qs.set("listType", params?.listType ?? fromTab?.listType ?? "TEP");
	qs.set("status", params?.status ?? fromTab?.status ?? "ALL");
	qs.set("version", params?.version ?? fromTab?.version ?? "V12");
	if (params?.sort === "ASC" || params?.sort === "DESC") {
		qs.set("sort", params.sort);
	}
	if (params?.keyword?.trim()) qs.set("keyword", params.keyword.trim());
	if (params?.templateId) qs.set("templateId", String(params.templateId));
	qs.set("networkCode", getClientMemeNetworkCode());

	const res = await fetch(`${publicEnv.bffUrl}/v1/tokens?${qs}`, {
		headers: buildHeaders(),
		credentials: "include",
	});
	return (await res.json()) as MemeResponse<TokenListItem[]>;
}

export type TokenListItem = {
	tokenId: number;
	name: string;
	shortName: string;
	tokenAddress: string;
	symbol: string;
	progress: string;
	price: string;
	cap: string;
	img: string;
	status: string;
	version: number;
	templateId?: string;
	hold?: number;
	volume?: string | number;
	day1Vol?: string | number;
	increase?: string | number;
	day1Increase?: string | number;
	minIncrease?: string | number;
	min5Increase?: string | number;
	hourIncrease?: string | number;
	hour4Increase?: string | number;
	createDate?: string | number;
	userAddress?: string;
	tag?: string;
};

export type ContractAddressRow = {
	name: string;
	address: string;
	networkCode: string;
};

export type TokenDetail = {
	id?: number;
	tokenId?: number;
	name: string;
	shortName: string;
	address: string;
	symbol: string;
	image?: string;
	img?: string;
	status: string | number;
	version?: number | string;
	progress?: string;
	price?: string;
	descr?: string;
};

/**
 * Return `undefined` (not `""`) when there is no image — empty string as `<img src>`
 * triggers Next.js "empty string passed to src" (browsers treat `src=""` as reload
 * current page). `undefined` omits the attribute in React.
 */
export function imageUrl(path?: string | null): string | undefined {
	if (!path) return undefined;
	if (/^https?:\/\//i.test(path)) return path;
	const p = path.startsWith("/") ? path : `/${path}`;
	return `${publicEnv.fileHost}${p}`;
}

/** Period enum matching meme-launcher datafeed */
export type BarTypeEnum =
	| "MIN1"
	| "MIN5"
	| "MIN15"
	| "HOUR1"
	| "HOUR4"
	| "DAY1";

export type BarCandle = {
	id?: number;
	open: string | number;
	high: string | number;
	low: string | number;
	close: string | number;
	volume?: string | number;
	amount?: string | number;
	tokenId?: number;
	type?: BarTypeEnum | string;
	/** Millisecond timestamp (upstream often returns a string) */
	createDate: string | number;
	category?: number;
};

/** meme-launcher: status === TRADE (or code 3) means graduated to DEX */
export function isTokenOnDex(status?: string | number | null): boolean {
	if (status == null || status === "") return false;
	if (typeof status === "number") return status === 3;
	const s = String(status).trim().toUpperCase();
	return s === "TRADE" || s === "3";
}

/**
 * Candle history (aligned with meme-launcher datafeed):
 * - Bonding: POST /meme-api/v1/public/bar
 * - Graduated DEX: POST /meme-api/v1/public/bar/new (server merges bonding+DEX)
 */
export async function fetchBars(params: {
	tokenId: number;
	typeEnum: BarTypeEnum;
	onDex?: boolean;
	/** DEX quote basis: ORIGINAL=quote asset, USDT=USDT basis */
	quoteMode?: "ORIGINAL" | "USDT";
	pageSize?: number;
	startDate?: number;
	endDate?: number;
}): Promise<BarCandle[]> {
	const pageSize = params.pageSize ?? 300;
	const onDex = Boolean(params.onDex);

	const res = onDex
		? await memePost<BarCandle[]>("/meme-api/v1/public/bar/new", {
				tokenId: params.tokenId,
				typeEnum: params.typeEnum,
				pageSize,
				endDate: params.endDate,
				symbol: params.quoteMode ?? "ORIGINAL",
			})
		: await memePost<BarCandle[]>("/meme-api/v1/public/bar", {
				tokenId: params.tokenId,
				typeEnum: params.typeEnum,
				pageSize,
				startDate: params.startDate ?? 1,
				endDate: params.endDate,
			});

	if (res.code !== 0) {
		throw new Error(res.msg || "Failed to load bars");
	}
	return res.data || [];
}

/**
 * DEX live-bar category filter (same as meme-launcher datafeed).
 * ORIGINAL → 0; USDT basis → 1 (still 0 when quote itself is USDT).
 */
export function barRealtimeCategory(params: {
	onDex: boolean;
	quoteMode?: "ORIGINAL" | "USDT";
	raisedSymbol?: string;
}): number {
	if (!params.onDex) return 0;
	if (params.quoteMode === "USDT") {
		return String(params.raisedSymbol || "").toUpperCase() === "USDT" ? 0 : 1;
	}
	return 0;
}

export function acceptRealtimeBar(params: {
	onDex: boolean;
	expectedCategory: number;
	barCategory?: number;
}): boolean {
	if (!params.onDex) return true;
	return Boolean(params.barCategory) === Boolean(params.expectedCategory);
}

export type TokenHolder = {
	address: string;
	userName?: string;
	amount: string | number;
};

export type TokenHolderResponse = {
	reserve?: TokenHolder | null;
	lp?: TokenHolder | null;
	clickFun?: TokenHolder | null;
	tokenHolders?: TokenHolder[];
};

export async function fetchTokenHolders(tokenId: number) {
	return memeGet<TokenHolderResponse>(
		"/meme-api/api/v1/public/token/holder",
		{ tokenId },
	);
}

export type TokenFill = {
	userAddress: string;
	userName?: string;
	userId?: number;
	avatarPath?: string;
	symbol?: string;
	side: string;
	txHash: string;
	price: string;
	amount: string;
	volume: string;
	createDate: string | number;
	tokenId?: number;
};

export async function fetchTokenFills(params: {
	tokenId: number;
	pageIndex?: number;
	pageSize?: number;
}) {
	return memeGet<TokenFill[]>("/meme-api/api/v1/public/token/fill", {
		tokenId: params.tokenId,
		pageIndex: params.pageIndex ?? 1,
		pageSize: params.pageSize ?? 40,
		networkCode: toMemeApiNetworkCode(),
	});
}
