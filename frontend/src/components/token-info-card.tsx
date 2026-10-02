/**
 * Right Token Info: reuse detail-page token and ticker data.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { CopyIcon } from "@/components/copy-icon";
import { FlashValue } from "@/components/flash-value";
import {
	deriveLiveMarketCap,
} from "@/components/token-metrics";
import type {
	TokenHeaderModel,
	TokenHeaderTicker,
} from "@/components/token-header";
import { useTokenLiquidity } from "@/hooks/use-token-liquidity";
import { useTokenTradeFlags } from "@/hooks/use-token-trade-flags";
import { useQuoteTickerPrices } from "@/hooks/use-quote-ticker-prices";
import { bondingProgressPct, resolveTargetRaiseAmount } from "@/lib/bonding-progress";
import { formatAddress, formatCompact, formatNum } from "@/lib/format";
import { isTokenOnDex } from "@/lib/meme-api";
import { useI18n } from "@/i18n/provider";

function formatTaxPct(n: number): string {
	if (!Number.isFinite(n) || n <= 0) return "0";
	const rounded = Math.round(n * 100) / 100;
	return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function TokenInfoCard({
	token,
	ticker,
	livePrice,
}: {
	token: TokenHeaderModel;
	ticker?: TokenHeaderTicker | null;
	livePrice?: string | null;
}) {
	const { t, href } = useI18n();
	const [copied, setCopied] = useState<"token" | "creator" | null>(null);
	const { priceOf } = useQuoteTickerPrices();
	const flags = useTokenTradeFlags(token.address);
	const hasTax = flags.feeRateBuy > 0 || flags.feeRateSell > 0;
	const description = token.descr?.trim() || "";
	const onDex = isTokenOnDex(ticker?.status ?? token.status);
	const quoteUsd = priceOf(token.symbol);
	const marketCap = deriveLiveMarketCap(
		livePrice,
		ticker?.price,
		ticker?.marketCap,
		token.totalAmount,
		{ onDex, quoteUsd },
	);
	const progressPct = bondingProgressPct(ticker?.progress);
	const raisedQuote = ticker?.bnbAmount;
	const quoteLabel = token.quoteLabel || token.symbol || "—";
	const targetRaise = resolveTargetRaiseAmount({
		raisedAmount: token.raisedAmount,
		raisedQuote,
		progress: ticker?.progress,
	});
	const { liquidity: calculatedLiquidity } = useTokenLiquidity({
		onDex,
		tokenAddress: token.address,
		tokenDecimals: token.decimals,
		quoteSymbol: token.symbol || "BNB",
		quoteAddress: token.quoteAddress,
		quoteDecimals: token.quoteDecimals,
		pairAddress: token.pairAddress,
		pancakeVersion: token.pancakeVersion,
		tokenPrice: livePrice || ticker?.price,
	});
	const liquidity = calculatedLiquidity ?? ticker?.liquidity;

	const copyText = async (value: string, kind: "token" | "creator") => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(kind);
			window.setTimeout(() => setCopied(null), 1200);
		} catch {
			setCopied(null);
		}
	};

	return (
		<section className="token-info-card">
			<h2>{t("token.info")}</h2>
			{!onDex ? (
				<div className="token-info-progress">
					<div className="token-info-progress-head">
						<span className="muted">{t("market.progress")}</span>
						<strong>{progressPct.toFixed(2)}%</strong>
					</div>
					<div className="token-progress-track">
						<div
							className="token-progress-bar"
							style={{
								width: `${Math.min(100, Math.max(0, progressPct))}%`,
							}}
						/>
					</div>
					<p className="muted token-info-progress-meta">
						{t("token.raised")}{" "}
						{raisedQuote != null && raisedQuote !== ""
							? `${formatNum(raisedQuote, 6)} ${quoteLabel}`
							: "—"}
						{" · "}
						{t("token.targetRaise")}{" "}
						{targetRaise
							? `${formatNum(targetRaise, 6)} ${quoteLabel}`
							: "—"}
					</p>
				</div>
			) : null}
			<dl>
				<dt>{t("token.name")}</dt>
				<dd>{token.name || "—"}</dd>

				<dt>{t("token.symbol")}</dt>
				<dd>{token.shortName || "—"}</dd>

				{description ? (
					<>
						<dt>{t("token.description")}</dt>
						<dd className="token-info-desc-dd">{description}</dd>
					</>
				) : null}

				<dt>{t("token.contract")}</dt>
				<dd>
					<button
						type="button"
						className={`token-info-copy${copied === "token" ? " copied" : ""}`}
						onClick={() => copyText(token.address, "token")}
						title={token.address}
						aria-label={t("token.copyContract")}
					>
						{formatAddress(token.address, 4)}
						<CopyIcon />
					</button>
				</dd>

				<dt>{t("token.developer")}</dt>
				<dd>
					{token.userAddress ? (
						<button
							type="button"
							className={`token-info-copy${copied === "creator" ? " copied" : ""}`}
							onClick={() =>
								copyText(token.userAddress as string, "creator")
							}
							title={token.userAddress}
							aria-label={t("token.copyDeveloper")}
						>
							{formatAddress(token.userAddress, 4)}
							<CopyIcon />
						</button>
					) : (
						"—"
					)}
				</dd>

				{hasTax ? (
					<>
						<dt>{t("tax.buyTax")}</dt>
						<dd>{formatTaxPct(flags.feeRateBuy)}%</dd>
						<dt>{t("tax.sellTax")}</dt>
						<dd>{formatTaxPct(flags.feeRateSell)}%</dd>
					</>
				) : null}

				<dt>{t("token.decimals")}</dt>
				<dd>{token.decimals ?? "—"}</dd>

				<dt>{t("token.totalSupply")}</dt>
				<dd>{formatNum(token.totalAmount, 0)}</dd>

				<dt>{t("token.liquidity")}</dt>
				<dd>
					<FlashValue value={liquidity}>
						${formatCompact(liquidity)}
					</FlashValue>
				</dd>

				<dt>{t("token.marketCap")}</dt>
				<dd>
					<FlashValue value={marketCap}>
						${formatCompact(marketCap, 2)}
					</FlashValue>
				</dd>
			</dl>
			{hasTax ? (
				<Link
					href={href(`/token/${token.address}/tax`)}
					className="token-info-tax-link"
				>
					{t("token.viewTaxDetails")}
				</Link>
			) : null}
		</section>
	);
}
