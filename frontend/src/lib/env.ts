/**
 * Frontend public env. Never put any apiKey here.
 *
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` when accessed with a
 * static property name. Dynamic `process.env[name]` is undefined in the browser.
 */
function requireUrl(value: string | undefined, label: string): string {
	if (!value) {
		throw new Error(`Missing required env: ${label}`);
	}
	return value.replace(/\/$/, "");
}

export const publicEnv = {
	bffUrl: requireUrl(
		process.env.NEXT_PUBLIC_BFF_URL ||
			(process.env.NODE_ENV === "development"
				? "http://localhost:8787"
				: undefined),
		"NEXT_PUBLIC_BFF_URL",
	),
	/** PROD = BSC 56 + Robinhood 4663; otherwise BSC testnet 97 + Robinhood testnet 46630 */
	isProd: process.env.NEXT_PUBLIC_MODE === "PROD",
	/** BSC fallback template; per-chain create presets come from BFF /v1/config */
	openFourTemplateId: Number(
		process.env.NEXT_PUBLIC_OPEN_FOUR_TEMPLATE_ID || "1778027615733",
	),
	fileHost:
		process.env.NEXT_PUBLIC_FILE_HOST?.replace(/\/$/, "") ||
		"https://static.four.meme",
	/** Optional; omit to read OpenFourCore.zapRouter() */
	zapRouterAddress: process.env.NEXT_PUBLIC_ZAP_ROUTER_ADDRESS || "",
	zapDebug:
		process.env.NEXT_PUBLIC_ZAP_DEBUG === "true" ||
		process.env.NEXT_PUBLIC_MODE !== "PROD",
	/** Optional; comma-separated override of default public RPC list */
	rpcUrls: process.env.NEXT_PUBLIC_RPC_URLS || "",
	/** Optional; comma-separated override of Robinhood Chain public RPCs */
	robinhoodRpcUrls: process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URLS || "",
} as const;
