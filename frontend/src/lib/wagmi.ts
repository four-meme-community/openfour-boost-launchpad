/**
 * Wagmi config: injected + BSC / Robinhood multi public-RPC fallback.
 */
"use client";

import { createConfig, fallback, http } from "wagmi";
import { bsc, bscTestnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import {
	resolveBscRpcUrls,
	resolveBscTestnetRpcUrls,
	resolveRobinhoodRpcUrls,
	robinhood,
} from "./rpc";

const bscRpcs = resolveBscRpcUrls();
const testnetRpcs = resolveBscTestnetRpcUrls();
const robinhoodRpcs = resolveRobinhoodRpcUrls();

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
	chains: [bsc, bscTestnet, robinhood],
	connectors: [injected({ shimDisconnect: true })],
	transports: {
		[bsc.id]: transportFor(bscRpcs),
		[bscTestnet.id]: transportFor(testnetRpcs),
		[robinhood.id]: transportFor(robinhoodRpcs),
	},
	ssr: true,
});

export const BSC_RPC_URL = bscRpcs[0];
export const BSC_RPC_URLS_LIST = bscRpcs;
export const ROBINHOOD_RPC_URL = robinhoodRpcs[0];
export const ROBINHOOD_RPC_URLS_LIST = robinhoodRpcs;
