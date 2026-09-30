/**
 * Public RPC lists: BSC / Robinhood; wagmi transport uses fallback polling.
 */
import { defineChain } from "viem";
import { publicEnv } from "./env";

/** BSC mainnet public RPCs */
export const BSC_RPC_URLS = [
	"https://bsc-dataseed.bnbchain.org/",
	"https://bsc-dataseed1.bnbchain.org/",
	"https://bsc-dataseed2.bnbchain.org/",
	"https://bsc-dataseed3.bnbchain.org/",
	"https://bsc-dataseed4.bnbchain.org/",
	"https://bsc-dataseed1.defibit.io/",
	"https://bsc-dataseed2.defibit.io/",
	"https://bsc-dataseed3.defibit.io/",
	"https://bsc-dataseed4.defibit.io/",
	"https://bsc-dataseed1.ninicoin.io/",
	"https://bsc-dataseed2.ninicoin.io/",
	"https://bsc-dataseed3.ninicoin.io/",
	"https://bsc-dataseed4.ninicoin.io/",
	"https://bsc-rpc.publicnode.com",
	"https://1rpc.io/bnb",
	"https://bsc.meowrpc.com",
	"https://bsc.blockrazor.xyz",
	"https://rpc-bsc.48.club",
	"https://bsc-mainnet.public.blastapi.io",
] as const;

export const BSC_TESTNET_RPC_URLS = [
	"https://bsc-testnet-dataseed.bnbchain.org",
	"https://data-seed-prebsc-1-s1.bnbchain.org:8545",
	"https://data-seed-prebsc-2-s1.bnbchain.org:8545",
	"https://bsc-testnet-rpc.publicnode.com",
	"https://bsc-testnet.drpc.org",
] as const;

/**
 * Robinhood Chain mainnet HTTP RPCs (from list screenshot; no wss).
 * Chain ID 4663。
 */
export const ROBINHOOD_RPC_URLS = [
	"https://rpc.mainnet.chain.robinhood.com",
	"https://robinhood-rpc.publicnode.com",
	"https://robinhood.api.pocket.network",
	"https://robinhood.rpc.blxrbdn.com",
	"https://rpc-robinhood.blockmachine.io",
	"https://rpc.nodeflare.app/robinhood/public",
] as const;

export const ROBINHOOD_TESTNET_RPC_URLS = [
	"https://rpc.testnet.chain.robinhood.com",
] as const;

/** Optional WebSockets (for future subs; not used in http transport) */
export const ROBINHOOD_WSS_URLS = [
	"wss://robinhood-rpc.publicnode.com",
	"wss://robinhood.api.pocket.network",
] as const;

const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

export const robinhood = defineChain({
	id: 4663,
	name: "Robinhood",
	nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
	rpcUrls: {
		default: { http: [...ROBINHOOD_RPC_URLS] },
	},
	blockExplorers: {
		default: {
			name: "Blockscout",
			url: "https://robinhoodchain.blockscout.com",
		},
	},
	contracts: {
		multicall3: { address: MULTICALL3 },
	},
});

export const robinhoodTestnet = defineChain({
	id: 46630,
	name: "Robinhood Testnet",
	nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
	rpcUrls: {
		default: { http: [...ROBINHOOD_TESTNET_RPC_URLS] },
	},
	blockExplorers: {
		default: {
			name: "Blockscout",
			url: "https://explorer.testnet.chain.robinhood.com",
		},
	},
	contracts: {
		multicall3: {
			address: "0x25087FA102b88C69d77F8a82920234eEEb5CB554",
		},
	},
	testnet: true,
});

function parseEnvRpcUrls(raw?: string): string[] {
	if (!raw?.trim()) return [];
	return raw
		.split(",")
		.map((u) => u.trim())
		.filter(Boolean);
}

export function resolveBscRpcUrls(): string[] {
	const env = parseEnvRpcUrls(publicEnv.rpcUrls);
	if (env.length > 0) return env;
	return [...BSC_RPC_URLS];
}

export function resolveBscTestnetRpcUrls(): string[] {
	const env = parseEnvRpcUrls(publicEnv.rpcUrls);
	if (env.length > 0 && !publicEnv.isProd) return env;
	return [...BSC_TESTNET_RPC_URLS];
}

export function resolveRobinhoodRpcUrls(): string[] {
	const env = parseEnvRpcUrls(publicEnv.robinhoodRpcUrls);
	if (env.length > 0 && publicEnv.isProd) return env;
	return [...ROBINHOOD_RPC_URLS];
}

export function resolveRobinhoodTestnetRpcUrls(): string[] {
	const env = parseEnvRpcUrls(publicEnv.robinhoodRpcUrls);
	if (env.length > 0 && !publicEnv.isProd) return env;
	return [...ROBINHOOD_TESTNET_RPC_URLS];
}
