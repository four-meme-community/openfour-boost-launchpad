/**
 * Switchable chains from BFF GET /v1/config.
 * Client snapshot is filled by SiteConfigProvider; SSR uses React context.
 */
import { publicEnv } from "./env";

export type PublicChain = {
	key: string;
	id: "bsc" | "robinhood";
	query: string;
	code: string;
	chainId: number;
	label: string;
	walletNetworkCode: "BSC" | "ROBINHOOD";
	nativeSymbol: "BNB" | "ETH";
	/** OpenFour create preset / template ids from BFF `/v1/config` */
	presetIds: string[];
};

function withPresetIds(
	chain: Omit<PublicChain, "presetIds"> & { presetIds?: string[] },
): PublicChain {
	const presetIds = Array.isArray(chain.presetIds)
		? chain.presetIds.map(String).filter(Boolean)
		: [];
	return { ...chain, presetIds };
}

export function fallbackPublicChains(): {
	chains: PublicChain[];
	defaultChain: string;
} {
	if (publicEnv.isProd) {
		return {
			chains: [
				withPresetIds({
					key: "bsc",
					id: "bsc",
					query: "bsc",
					code: "0",
					chainId: 56,
					label: "BSC",
					walletNetworkCode: "BSC",
					nativeSymbol: "BNB",
				}),
				withPresetIds({
					key: "robinhood",
					id: "robinhood",
					query: "robinhood",
					code: "8",
					chainId: 4663,
					label: "Robinhood Chain",
					walletNetworkCode: "ROBINHOOD",
					nativeSymbol: "ETH",
				}),
			],
			defaultChain: "bsc",
		};
	}
	return {
		chains: [
			withPresetIds({
				key: "bsc-testnet",
				id: "bsc",
				query: "bsc",
				code: "0",
				chainId: 97,
				label: "BSC Testnet",
				walletNetworkCode: "BSC",
				nativeSymbol: "BNB",
			}),
			withPresetIds({
				key: "robinhood-testnet",
				id: "robinhood",
				query: "robinhood",
				code: "8",
				chainId: 46630,
				label: "Robinhood Chain Testnet",
				walletNetworkCode: "ROBINHOOD",
				nativeSymbol: "ETH",
			}),
		],
		defaultChain: "bsc-testnet",
	};
}

const FALLBACK = fallbackPublicChains();

let snapshot = FALLBACK;

function resolveDefault(
	chains: PublicChain[],
	defaultChain?: string,
): PublicChain {
	if (chains.length === 0) return FALLBACK.chains[0];
	const key = (defaultChain || "").trim().toLowerCase();
	return (
		chains.find((c) => c.key === key) ||
		chains.find((c) => c.id === key) ||
		chains[0]
	);
}

/** Client-only: do not mutate this on the server (avoids cross-request leaks). */
export function applySiteChains(
	chains: PublicChain[] | undefined,
	defaultChain?: string,
) {
	if (typeof window === "undefined") return;
	const list = (
		chains && chains.length > 0 ? chains : fallbackPublicChains().chains
	).map(withPresetIds);
	const def = resolveDefault(list, defaultChain);
	snapshot = { chains: list, defaultChain: def.key };
}

export function getConfiguredChains(): PublicChain[] {
	return snapshot.chains;
}

export function getDefaultPublicChain(): PublicChain {
	return (
		snapshot.chains.find((c) => c.key === snapshot.defaultChain) ||
		snapshot.chains[0]
	);
}

export function getPublicChainByCode(
	code?: string | number | null,
): PublicChain {
	const raw = String(code ?? "").trim();
	return (
		snapshot.chains.find(
			(c) => c.code === raw || c.key === raw || c.id === raw,
		) || getDefaultPublicChain()
	);
}

export function getPublicChainByChainId(chainId: number): PublicChain {
	return (
		snapshot.chains.find((c) => c.chainId === chainId) ||
		getDefaultPublicChain()
	);
}

export function getPublicChainByQuery(
	query?: string | null,
): PublicChain {
	const id = String(query ?? "")
		.trim()
		.toLowerCase();
	if (!id) return getDefaultPublicChain();
	return (
		snapshot.chains.find((c) => c.query === id || c.id === id || c.key === id) ||
		getDefaultPublicChain()
	);
}

export function isChainEnabled(queryOrCode: string): boolean {
	const raw = queryOrCode.trim().toLowerCase();
	return snapshot.chains.some(
		(c) =>
			c.query === raw ||
			c.id === raw ||
			c.key === raw ||
			c.code === queryOrCode,
	);
}
