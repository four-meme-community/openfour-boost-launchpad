/**
 * Chain config: PROD → BSC mainnet, otherwise BSC testnet.
 *
 * Convention:
 * - On-chain / wagmi / balances / contracts: always native `CHAIN.id` (BSC=56)
 * - meme-api networkCode only: BSC mainnet 56 → 0 (see `toMemeApiNetworkCode`)
 */
import { bsc, bscTestnet } from "wagmi/chains";
import { publicEnv } from "./env";

export const CHAIN = publicEnv.isProd ? bsc : bscTestnet;

export const NATIVE_BNB = "0x0000000000000000000000000000000000000000";

/**
 * meme-api-only networkCode.
 * Map BSC mainnet chainId 56 → 0 only when calling meme-api; do not use elsewhere.
 */
export function toMemeApiNetworkCode(chainId: number = CHAIN.id): number {
	if (chainId === 56) return 0;
	return chainId;
}

/** Some meme-api endpoints use string network codes (e.g. address / login) */
export function toMemeApiNetworkName(chainId: number = CHAIN.id): "BSC" | "BSC_TESTNET" {
	return chainId === 56 ? "BSC" : "BSC_TESTNET";
}
