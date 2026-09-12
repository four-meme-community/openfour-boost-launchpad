/**
 * Wagmi config: injected + BSC / Robinhood (mainnet or testnet by MODE).
 */
"use client";

import { createConfig, fallback, http } from "wagmi";
import { bsc, bscTestnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { publicEnv } from "./env";
import {
	resolveBscRpcUrls,
	resolveBscTestnetRpcUrls,
	resolveRobinhoodRpcUrls,
	resolveRobinhoodTestnetRpcUrls,
	robinhood,
	robinhoodTestnet,
} from "./rpc";

const bscRpcs = resolveBscRpcUrls();
const testnetRpcs = resolveBscTestnetRpcUrls();
const robinhoodRpcs = resolveRobinhoodRpcUrls();
const robinhoodTestnetRpcs = resolveRobinhoodTestnetRpcUrls();

function transportFor(urls: string[]) {
	return fallback(
		urls.map((url) =>
			http(url, {
				timeout: 8_000,
				retryCount: 0,
			}),
		),
		{ rank: false },
	);
}

export const wagmiConfig = createConfig({
	chains: [bsc, bscTestnet, robinhood, robinhoodTestnet],
	connectors: [injected({ shimDisconnect: true })],
	transports: {
		[bsc.id]: transportFor(bscRpcs),
		[bscTestnet.id]: transportFor(testnetRpcs),
		[robinhood.id]: transportFor(robinhoodRpcs),
		[robinhoodTestnet.id]: transportFor(robinhoodTestnetRpcs),
	},
	ssr: true,
});

export const BSC_RPC_URL = publicEnv.isProd ? bscRpcs[0] : testnetRpcs[0];
export const BSC_RPC_URLS_LIST = publicEnv.isProd ? bscRpcs : testnetRpcs;
export const ROBINHOOD_RPC_URL = publicEnv.isProd
	? robinhoodRpcs[0]
	: robinhoodTestnetRpcs[0];
export const ROBINHOOD_RPC_URLS_LIST = publicEnv.isProd
	? robinhoodRpcs
	: robinhoodTestnetRpcs;
