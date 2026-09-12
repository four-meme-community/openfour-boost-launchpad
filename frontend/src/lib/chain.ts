/**
 * Wagmi chain lookup from BFF-configured chainId.
 *
 * Convention (same as meme-launcher):
 * - On-chain / wagmi: native chain id from `/v1/config`
 * - meme-api header `meme-network-code`: BSC family → 0, Robinhood family → 8
 * - Login / address `networkCode` string: "BSC" | "ROBINHOOD"
 */
import { bsc, bscTestnet } from "wagmi/chains";
import { getPublicChainByChainId, getPublicChainByCode } from "./chain-config";
import {
	getClientMemeNetworkCode,
	getNativeQuoteSymbol as nativeQuoteForCode,
	getWalletNetworkCode,
	type MemeNetworkCode,
} from "./network";
import { robinhood, robinhoodTestnet } from "./rpc";

const WAGMI_CHAINS = [bsc, bscTestnet, robinhood, robinhoodTestnet] as const;

export function getWagmiChain(chainId: number) {
	return WAGMI_CHAINS.find((chain) => chain.id === chainId) ?? bsc;
}

export function getChainByNetworkCode(code?: string | number | null) {
	const cfg = getPublicChainByCode(code);
	return getWagmiChain(cfg.chainId);
}

export const BSC_CHAIN = getChainByNetworkCode("0");
export const ROBINHOOD_CHAIN = getChainByNetworkCode("8");

export function getActiveChain() {
	return getChainByNetworkCode(getClientMemeNetworkCode());
}

export const CHAIN = getActiveChain();

export const NATIVE_BNB = "0x0000000000000000000000000000000000000000";
export const NATIVE_ADDRESS = NATIVE_BNB;

export function toMemeApiNetworkCode(
	chainOrCode: number | string = getClientMemeNetworkCode(),
): number {
	if (typeof chainOrCode === "string") {
		return Number(getPublicChainByCode(chainOrCode).code);
	}
	return Number(getPublicChainByChainId(chainOrCode).code);
}

export function toMemeApiNetworkName(
	chainOrCode: number | string = getClientMemeNetworkCode(),
): "BSC" | "ROBINHOOD" {
	if (typeof chainOrCode === "string") {
		return getWalletNetworkCode(chainOrCode);
	}
	return getPublicChainByChainId(chainOrCode).walletNetworkCode;
}

export function currentMemeNetworkCode(): MemeNetworkCode {
	return getClientMemeNetworkCode();
}

export function currentNativeQuoteSymbol(): "BNB" | "ETH" {
	return nativeQuoteForCode(getClientMemeNetworkCode());
}
