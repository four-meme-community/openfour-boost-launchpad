/**
 * Frontend public env. Never put any apiKey here.
 */
function requirePublic(name: string, fallback?: string): string {
	const value = process.env[name] ?? fallback;
	if (!value) {
		throw new Error(`Missing required env: ${name}`);
	}
	return value.replace(/\/$/, "");
}

export const publicEnv = {
	bffUrl: requirePublic(
		"NEXT_PUBLIC_BFF_URL",
		process.env.NODE_ENV === "development"
			? "http://localhost:8787"
			: undefined,
	),
	isProd: process.env.NEXT_PUBLIC_MODE === "PROD",
	wcProjectId: process.env.NEXT_PUBLIC_PROJECT_ID || "",
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
