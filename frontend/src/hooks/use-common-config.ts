/**
 * Cached `/meme-api/v1/public/config` — quote rows expose `nativeSymbol`
 * for user-facing tickers (RETH→ETH, RUSDG→USDG).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
	loadCommonConfig,
	matchCommonConfig,
	quoteDisplaySymbol,
	type CommonConfigItem,
} from "@/lib/open-four";
import { isNativeQuoteSymbol } from "@/lib/network";

let cached: CommonConfigItem[] | null = null;
let inflight: Promise<CommonConfigItem[]> | null = null;

export async function ensureCommonConfig(): Promise<CommonConfigItem[]> {
	if (cached) return cached;
	if (!inflight) {
		inflight = loadCommonConfig()
			.then((data) => {
				cached = data || [];
				return cached;
			})
			.catch(() => {
				cached = cached || [];
				return cached;
			})
			.finally(() => {
				inflight = null;
			});
	}
	return inflight;
}

export function useCommonConfig() {
	const [config, setConfig] = useState<CommonConfigItem[]>(
		() => cached || [],
	);

	useEffect(() => {
		let cancelled = false;
		void ensureCommonConfig().then((next) => {
			if (!cancelled) setConfig(next);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	/** User-facing quote ticker: config.nativeSymbol || api symbol. */
	const displayOf = useCallback(
		(apiSymbol?: string | null) =>
			quoteDisplaySymbol(apiSymbol, config) || String(apiSymbol || ""),
		[config],
	);

	/**
	 * Whether paying/settling this pair quote uses chain native.
	 * Uses config.nativeSymbol (RETH→ETH) then compares to chain native.
	 */
	const isNativePaymentQuote = useCallback(
		(apiSymbol?: string | null) => {
			if (!apiSymbol) return false;
			if (isNativeQuoteSymbol(apiSymbol)) return true;
			const row = matchCommonConfig(config, apiSymbol);
			const native = row?.nativeSymbol?.trim();
			return native ? isNativeQuoteSymbol(native) : false;
		},
		[config],
	);

	return { config, displayOf, isNativePaymentQuote };
}
