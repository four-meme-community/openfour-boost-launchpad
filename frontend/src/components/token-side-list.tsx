/**
 * Detail left token list: new / almost graduated / graduated + search.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FlashValue } from "@/components/flash-value";
import { PriceText } from "@/components/price-text";
import { Skeleton } from "@/components/skeleton";
import {
	fetchTokenList,
	imageUrl,
	isTokenOnDex,
	type MarketTab,
	type TokenListItem,
} from "@/lib/meme-api";
import { formatCompact, formatPct } from "@/lib/format";
import { toUsdMarketCap, toUsdPrice } from "@/lib/quote-usd";
import { useQuoteTickerPrices } from "@/hooks/use-quote-ticker-prices";
import { useI18n } from "@/i18n/provider";

const TABS: MarketTab[] = ["new", "soon", "graduated"];

function toPctNumber(value?: string | number | null): number | null {
	if (value == null || value === "") return null;
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	return Math.abs(n) <= 1 ? n * 100 : n;
}

function changeClass(value?: string | number | null) {
	const n = toPctNumber(value);
	if (n == null || n === 0) return "flat";
	return n > 0 ? "up" : "down";
}

export function TokenSideList({
	activeAddress,
}: {
	activeAddress?: string | null;
}) {
	const { href, t } = useI18n();
	const { priceOf } = useQuoteTickerPrices();
	const [tab, setTab] = useState<MarketTab>("new");
	const [query, setQuery] = useState("");
	const [debounced, setDebounced] = useState("");
	const [items, setItems] = useState<TokenListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const t = window.setTimeout(() => setDebounced(query.trim()), 300);
		return () => window.clearTimeout(t);
	}, [query]);

	const load = useCallback(
		async (nextTab: MarketTab, keyword: string, opts?: { silent?: boolean }) => {
			if (!opts?.silent) {
				setLoading(true);
				setError(null);
			}
			try {
				const res = await fetchTokenList({
					pageIndex: 1,
					pageSize: 40,
					tab: nextTab,
					keyword: keyword || undefined,
				});
				if (res.code !== 0) throw new Error("load_failed");
				setItems(res.data || []);
				if (!opts?.silent) setError(null);
			} catch {
				if (!opts?.silent) {
					setItems([]);
					setError(t("error.load"));
				}
			} finally {
				if (!opts?.silent) setLoading(false);
			}
		},
		[t],
	);

	useEffect(() => {
		void load(tab, debounced);
		const timer = window.setInterval(() => {
			void load(tab, debounced, { silent: true });
		}, 12_000);
		return () => window.clearInterval(timer);
	}, [tab, debounced, load]);

	const active = (activeAddress || "").toLowerCase();

	return (
		<aside className="token-side-panel">
			<div className="token-side-head">
				<div className="token-side-tabs" role="tablist">
					{TABS.map((tabId) => (
						<button
							key={tabId}
							type="button"
							role="tab"
							aria-selected={tab === tabId}
							className={`token-side-tab${tab === tabId ? " active" : ""}`}
							onClick={() => setTab(tabId)}
						>
							{t(
								tabId === "new"
									? "market.new"
									: tabId === "soon"
										? "market.graduating"
										: "market.graduated",
							)}
						</button>
					))}
				</div>
			</div>

			<label className="token-side-search">
				<span className="token-side-search-icon" aria-hidden>
					⌕
				</span>
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={t("market.search")}
					autoComplete="off"
				/>
			</label>

			<div className="token-side-cols">
				<span>{t("market.tokenMarketCap")}</span>
				<span>{t("market.priceChange")}</span>
			</div>

			<div className="token-side-list">
				{error ? <p className="token-side-msg err">{error}</p> : null}
				{!loading && !error && !items.length ? (
					<p className="token-side-msg">{t("market.empty")}</p>
				) : null}

				{loading && !items.length
					? Array.from({ length: 10 }).map((_, i) => (
							<div className="token-side-row" key={i}>
								<Skeleton circle width={28} height={28} />
								<div className="token-side-meta">
									<Skeleton width="70%" height="0.82rem" />
									<Skeleton width="45%" height="0.7rem" />
								</div>
								<div className="token-side-quote">
									<Skeleton width="60%" height="0.82rem" />
									<Skeleton width="40%" height="0.7rem" />
								</div>
							</div>
						))
					: null}

				{items.map((item) => {
					const addr = (item.tokenAddress || "").toLowerCase();
					const isActive = !!active && addr === active;
					const chg = item.day1Increase ?? item.increase;
					const marketCapUsd = toUsdMarketCap(item.cap, {
						onDex: isTokenOnDex(item.status),
						quoteUsd: priceOf(item.symbol),
					});
					const priceUsd = toUsdPrice(item.price, {
						onDex: isTokenOnDex(item.status),
						quoteUsd: priceOf(item.symbol),
					});
					return (
						<Link
							key={item.tokenAddress || item.tokenId}
							href={href(`/token/${item.tokenAddress}`)}
							scroll={false}
							prefetch
							className={`token-side-row${isActive ? " active" : ""}`}
						>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={imageUrl(item.img)}
								alt=""
								className="token-side-img"
							/>
							<div className="token-side-meta">
								<strong>{item.shortName || item.name}</strong>
								<FlashValue value={marketCapUsd} className="token-side-cap">
									${formatCompact(marketCapUsd)} MC
								</FlashValue>
							</div>
							<div className="token-side-quote">
								<strong>
									<PriceText value={priceUsd} />
								</strong>
								<FlashValue
									value={chg}
									className={`mkt-chg ${changeClass(chg)}`}
								>
									{formatPct(chg)}
								</FlashValue>
							</div>
						</Link>
					);
				})}
			</div>
		</aside>
	);
}
