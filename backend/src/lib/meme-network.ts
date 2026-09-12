/**
 * meme-web cross-chain header (same as meme-launcher).
 * Allowed codes come from ENABLED_CHAINS on this deploy.
 */
import { publicChains } from "../config/env.js";

export const MEME_NETWORK_HEADER = "meme-network-code";

export function normalizeMemeNetworkCode(
	value?: string | number | null,
): string {
	const raw = String(value ?? "").trim();
	const match = publicChains.chains.find(
		(chain) =>
			chain.code === raw || chain.key === raw || chain.query === raw,
	);
	if (match) return match.code;
	const fallback =
		publicChains.chains.find((chain) => chain.key === publicChains.defaultChain) ||
		publicChains.chains[0];
	return fallback?.code ?? "0";
}
