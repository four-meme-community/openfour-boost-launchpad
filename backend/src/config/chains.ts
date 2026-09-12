/**
 * Switchable chains for this deploy. Frontend reads them from GET /v1/config.
 *
 * Env `ENABLED_CHAINS` is a comma-separated list of catalog keys.
 * One family per deploy (do not mix `bsc` + `bsc-testnet`).
 */
export type PublicChain = {
	/** Catalog key, e.g. bsc-testnet */
	key: string;
	/** Family id for icons: bsc | robinhood */
	id: "bsc" | "robinhood";
	/** URL `?chain=` value. Omitted when this is the default chain. */
	query: string;
	/** meme-web header `meme-network-code` (BSC family 0, Robinhood family 8) */
	code: string;
	/** Wallet / wagmi chain id */
	chainId: number;
	label: string;
	/** Login / address API networkCode */
	walletNetworkCode: "BSC" | "ROBINHOOD";
	nativeSymbol: "BNB" | "ETH";
};

const CHAIN_CATALOG: Record<string, PublicChain> = {
	bsc: {
		key: "bsc",
		id: "bsc",
		query: "bsc",
		code: "0",
		chainId: 56,
		label: "BSC",
		walletNetworkCode: "BSC",
		nativeSymbol: "BNB",
	},
	"bsc-testnet": {
		key: "bsc-testnet",
		id: "bsc",
		query: "bsc",
		code: "0",
		chainId: 97,
		label: "BSC Testnet",
		walletNetworkCode: "BSC",
		nativeSymbol: "BNB",
	},
	robinhood: {
		key: "robinhood",
		id: "robinhood",
		query: "robinhood",
		code: "8",
		chainId: 4663,
		label: "Robinhood Chain",
		walletNetworkCode: "ROBINHOOD",
		nativeSymbol: "ETH",
	},
	"robinhood-testnet": {
		key: "robinhood-testnet",
		id: "robinhood",
		query: "robinhood",
		code: "8",
		chainId: 46630,
		label: "Robinhood Chain Testnet",
		walletNetworkCode: "ROBINHOOD",
		nativeSymbol: "ETH",
	},
};

export const CHAIN_CATALOG_KEYS = Object.keys(CHAIN_CATALOG);

function parseList(raw: string): string[] {
	return raw
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
}

export function resolvePublicChains(params: {
	enabledChains: string;
	defaultChain: string;
}): { chains: PublicChain[]; defaultChain: string } {
	const keys = parseList(params.enabledChains);
	if (keys.length === 0) {
		throw new Error("ENABLED_CHAINS must list at least one chain");
	}

	const chains: PublicChain[] = [];
	const seenQuery = new Set<string>();
	for (const key of keys) {
		const chain = CHAIN_CATALOG[key];
		if (!chain) {
			throw new Error(
				`Unknown chain "${key}". Allowed: ${CHAIN_CATALOG_KEYS.join(", ")}`,
			);
		}
		if (seenQuery.has(chain.query)) {
			throw new Error(
				`ENABLED_CHAINS has two chains with query "${chain.query}" (${key})`,
			);
		}
		seenQuery.add(chain.query);
		chains.push(chain);
	}

	const defaultKey = params.defaultChain.trim().toLowerCase() || chains[0].key;
	const defaultChain =
		chains.find((c) => c.key === defaultKey) ??
		chains.find((c) => c.id === defaultKey) ??
		chains[0];

	return { chains, defaultChain: defaultChain.key };
}
