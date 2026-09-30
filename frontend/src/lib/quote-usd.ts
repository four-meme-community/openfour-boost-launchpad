/**
 * Quote → USD helpers (aligned with meme-launcher `toUsdMarketCap`).
 * Bonding marketCap/price volumes from meme-web are quote-denominated;
 * graduated (DEX) marketCap is already USD.
 */

const TICKER_SYMBOL_ALIASES: Record<string, string> = {
	BNB_MPC: "BNB",
	BNB_AI: "BNB",
};

export function resolveTickerSymbol(symbol?: string | null): string {
	if (!symbol) return "BNB";
	const raw = String(symbol).trim().toUpperCase();
	return TICKER_SYMBOL_ALIASES[raw] || raw;
}

/**
 * Convert quote-denominated market cap to USD.
 * DEX / TRADE: pass through. Bonding: × quote USD price.
 */
export function toUsdMarketCap(
	marketCap?: string | number | null,
	opts?: {
		onDex?: boolean;
		quoteUsd?: number | null;
	},
): number {
	const base = Number(marketCap);
	if (!Number.isFinite(base) || base === 0) return 0;
	if (opts?.onDex) return base;
	const quoteUsd = Number(opts?.quoteUsd);
	if (!Number.isFinite(quoteUsd) || quoteUsd <= 0) return base;
	return base * quoteUsd;
}

/** Bonding quote-volume → USD; DEX volumes already USD. */
export function toUsdVolume(
	volume?: string | number | null,
	opts?: {
		onDex?: boolean;
		quoteUsd?: number | null;
	},
): number {
	return toUsdMarketCap(volume, opts);
}

/**
 * Bonding unit price is quote-denominated (RETH/BNB); convert to USD for `$` UI.
 * DEX ticker/chart closes in USDT mode are already USD.
 */
export function toUsdPrice(
	price?: string | number | null,
	opts?: {
		onDex?: boolean;
		quoteUsd?: number | null;
	},
): number {
	return toUsdMarketCap(price, opts);
}
