/**
 * Market cap / progress / volume metrics (detail floating docker top).
 */
"use client";

import type { ReactNode } from "react";
import { FlashValue } from "@/components/flash-value";
import { PriceText } from "@/components/price-text";
import {
	formatCompact,
	formatNum,
	formatPct,
	formatSupply,
} from "@/lib/format";
import { useI18n } from "@/i18n/provider";
import { isTokenOnDex } from "@/lib/meme-api";
import { toUsdMarketCap, toUsdPrice } from "@/lib/quote-usd";
import type {
	TokenHeaderModel,
	TokenHeaderTicker,
} from "@/components/token-header";
import { bondingProgressPct, resolveTargetRaiseAmount } from "@/lib/bonding-progress";
import { useQuoteTickerPrices } from "@/hooks/use-quote-ticker-prices";

export function deriveLiveMarketCap(
	livePrice?: string | null,
	tickerPrice?: string | null,
	tickerMarketCap?: string | null,
	totalSupply?: string | number | null,
	opts?: {
		onDex?: boolean;
		quoteUsd?: number | null;
	},
): string | number | undefined {
	const live = Number(livePrice);
	let base: string | number | undefined;
	if (!Number.isFinite(live) || live <= 0) {
		base = tickerMarketCap ?? undefined;
	} else {
		const snapshotPrice = Number(tickerPrice);
		const snapshotCap = Number(tickerMarketCap);
		if (
			Number.isFinite(snapshotPrice) &&
			snapshotPrice > 0 &&
			Number.isFinite(snapshotCap) &&
			snapshotCap >= 0
		) {
			base = snapshotCap * (live / snapshotPrice);
		} else {
			const supply = Number(totalSupply);
			base =
				Number.isFinite(supply) && supply > 0
					? live * supply
					: tickerMarketCap ?? undefined;
		}
	}

	if (base == null || base === "") return undefined;
	const usd = toUsdMarketCap(base, opts);
	return usd;
}

export function TokenMetrics({
	token,
	ticker,
	livePrice,
	compact = false,
}: {
	token: TokenHeaderModel;
	ticker?: TokenHeaderTicker | null;
	livePrice?: string | null;
	compact?: boolean;
}) {
	const { t } = useI18n();
	const { priceOf } = useQuoteTickerPrices();
	const status = ticker?.status ?? token.status;
	const onDex = isTokenOnDex(status);
	const quoteLabel = token.quoteLabel || token.symbol || "BNB";
	const quoteUsd = priceOf(token.symbol);
	const rawPrice = livePrice || ticker?.price;
	const price =
		rawPrice != null && rawPrice !== "" && Number(rawPrice) > 0
			? toUsdPrice(rawPrice, { onDex, quoteUsd })
			: undefined;
	const marketCap = deriveLiveMarketCap(
		livePrice,
		ticker?.price,
		ticker?.marketCap,
		token.totalAmount,
		{ onDex, quoteUsd },
	);
	const progressPct = bondingProgressPct(ticker?.progress);
	const chg = ticker?.dayIncrease ?? ticker?.increase;
	const dayVol = ticker?.dayTrading || ticker?.tradingUsd;
	const raised = ticker?.bnbAmount;
	const targetRaise = resolveTargetRaiseAmount({
		raisedAmount: token.raisedAmount,
		raisedQuote: raised,
		progress: ticker?.progress,
	});

	if (compact) {
		const secondaryStats: {
			label: string;
			value: ReactNode;
			flashKey?: string | number | null;
		}[] = [
			{
				label: t("token.price"),
				value: <PriceText value={price} />,
			},
			...(onDex
				? []
				: [
						{
							label: t("market.progress"),
							value: `${progressPct.toFixed(2)}%`,
							flashKey: progressPct,
						},
					]),
			{
				label: t("token.volume24h"),
				value: `$${formatCompact(dayVol)}`,
				flashKey: dayVol,
			},
			{
				label: t("market.holders"),
				value:
					typeof ticker?.holderCount === "number"
						? ticker.holderCount.toLocaleString()
						: "—",
				flashKey: ticker?.holderCount,
			},
		];

		return (
			<div className="token-metrics token-metrics--compact">
				<div className="token-metrics-hero">
					<span className="muted">{t("token.marketCap")}</span>
					<div className="token-metrics-hero-row">
						<FlashValue
							value={marketCap}
							as="strong"
							className="token-metrics-hero-value"
						>
							${formatCompact(marketCap, 2)}
						</FlashValue>
						<FlashValue
							value={chg}
							className={Number(chg ?? 0) >= 0 ? "chg up" : "chg down"}
						>
							{formatPct(chg)}
						</FlashValue>
					</div>
				</div>
				<div className="token-metrics-secondary">
					{secondaryStats.map((item) => (
						<div key={item.label} className="token-stat">
							<span className="muted">{item.label}</span>
							{item.flashKey !== undefined ? (
								<FlashValue value={item.flashKey} as="strong">
									{item.value}
								</FlashValue>
							) : (
								<strong>{item.value}</strong>
							)}
						</div>
					))}
				</div>
			</div>
		);
	}

	const stats: {
		label: string;
		value: ReactNode;
		flashKey?: string | number | null;
	}[] = [
		{ label: t("token.price"), value: <PriceText value={price} /> },
		{
			label: onDex ? t("token.pool") : t("market.progress"),
			value: onDex
				? `$${formatCompact(ticker?.liquidity)}`
				: `${progressPct.toFixed(2)}%`,
			flashKey: onDex ? ticker?.liquidity : progressPct,
		},
		{
			label: t("token.volume24h"),
			value: `$${formatCompact(dayVol)}`,
			flashKey: dayVol,
		},
		{
			label: t("token.tradingVolume"),
			value: `$${formatCompact(ticker?.trading)}`,
			flashKey: ticker?.trading,
		},
		{
			label: t("token.totalSupply"),
			value: formatSupply(token.totalAmount),
		},
		{
			label: t("token.change24h"),
			value: formatPct(chg),
			flashKey: chg,
		},
	];

	if (!onDex) {
		stats.splice(2, 0, {
			label: t("token.targetRaise"),
			value:
				targetRaise != null
					? `${formatNum(targetRaise, 6)} ${quoteLabel}`
					: "—",
		});
		stats.splice(3, 0, {
			label: t("token.raised"),
			value:
				raised != null && raised !== ""
					? `${formatNum(raised, 6)} ${quoteLabel}`
					: "—",
			flashKey: raised,
		});
	}

	return (
		<div className="token-metrics">
			<div className="token-mcap">
				<span className="muted">{t("token.marketCap")}</span>
				<FlashValue value={marketCap} as="strong">
					${formatCompact(marketCap, 2)}
				</FlashValue>
				<FlashValue
					value={chg}
					className={
						Number(chg ?? 0) >= 0 ? "chg up" : "chg down"
					}
				>
					{formatPct(chg)}
				</FlashValue>
			</div>
			<div className="token-stats">
				{stats.map((item) => (
					<div key={item.label} className="token-stat">
						<span className="muted">{item.label}</span>
						{item.flashKey !== undefined ? (
							<FlashValue value={item.flashKey} as="strong">
								{item.value}
							</FlashValue>
						) : (
							<strong>{item.value}</strong>
						)}
					</div>
				))}
			</div>
			{!onDex ? (
				<div className="token-progress">
					<div className="token-progress-track">
						<div
							className="token-progress-bar"
							style={{
								width: `${Math.min(100, Math.max(0, progressPct))}%`,
							}}
						/>
					</div>
					<span className="muted">
						{t("token.targetRaise")}: {formatNum(targetRaise, 6)}{" "}
						{quoteLabel}
						{" · "}
						{t("token.raised")} {formatNum(raised, 6)} {quoteLabel}
						{" · "}
						{t("token.sale")} {formatSupply(token.saleAmount)} /{" "}
						{formatSupply(token.totalAmount)}
					</span>
				</div>
			) : null}
		</div>
	);
}
