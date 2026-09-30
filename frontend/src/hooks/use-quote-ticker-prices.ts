/**
 * Shared quote-asset USD map from `/meme-api/v1/public/ticker`
 * (same source as meme-launcher `@TICKER_EVENT`).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { memePost } from "@/lib/meme-api";
import { resolveTickerSymbol } from "@/lib/quote-usd";

type QuoteTicker = {
	symbol: string;
	price: string | number;
};

let cachedMap: Record<string, number> | null = null;
let inflight: Promise<Record<string, number>> | null = null;

async function loadQuoteTickerMap(): Promise<Record<string, number>> {
	if (cachedMap) return cachedMap;
	if (inflight) return inflight;

	inflight = (async () => {
		const res = await memePost<QuoteTicker[]>(
			"/meme-api/v1/public/ticker",
			{},
		);
		const next: Record<string, number> = { USDT: 1 };
		if (res.code === 0) {
			for (const row of res.data || []) {
				const key = resolveTickerSymbol(
					String(row.symbol || "").replace(/USDT$/i, ""),
				);
				const price = Number(row.price);
				if (key && Number.isFinite(price) && price > 0) {
					next[key] = price;
				}
			}
		}
		cachedMap = next;
		return next;
	})().finally(() => {
		inflight = null;
	});

	return inflight;
}

export function useQuoteTickerPrices() {
	const [map, setMap] = useState<Record<string, number>>(
		() => cachedMap || { USDT: 1 },
	);

	useEffect(() => {
		let cancelled = false;
		void loadQuoteTickerMap()
			.then((next) => {
				if (!cancelled) setMap(next);
			})
			.catch(() => {
				// Keep last map / USDT=1 fallback.
			});

		const timer = window.setInterval(() => {
			cachedMap = null;
			void loadQuoteTickerMap()
				.then((next) => {
					if (!cancelled) setMap(next);
				})
				.catch(() => {});
		}, 60_000);

		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, []);

	const priceOf = useCallback(
		(symbol?: string | null) => {
			const key = resolveTickerSymbol(symbol);
			const n = map[key];
			return Number.isFinite(n) && n > 0 ? n : 1;
		},
		[map],
	);

	return { map, priceOf };
}
