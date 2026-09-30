/**
 * Token detail header: token / quote + identity.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { AntiSniperFeeTip } from "@/components/anti-sniper-fee-tip";
import { CopyIcon } from "@/components/copy-icon";
import { useI18n } from "@/i18n/provider";
import { TokenMetrics } from "@/components/token-metrics";
import { useTokenTradeFlags } from "@/hooks/use-token-trade-flags";
import { formatAddress, formatAge } from "@/lib/format";
import { imageUrl } from "@/lib/meme-api";

function formatTaxPct(n: number): string {
	if (!Number.isFinite(n) || n <= 0) return "0";
	const rounded = Math.round(n * 100) / 100;
	return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export type TokenHeaderTicker = {
	price?: string;
	marketCap?: string;
	progress?: string;
	increase?: string;
	dayIncrease?: string;
	trading?: string;
	dayTrading?: string;
	tradingUsd?: string;
	liquidity?: string;
	holderCount?: number;
	status?: number | string;
	/** Bonding raised quote amount (field historically named bnbAmount) */
	bnbAmount?: string;
};

export type TokenHeaderModel = {
	name: string;
	shortName: string;
	symbol: string;
	address: string;
	image?: string | null;
	descr?: string | null;
	status?: string | number | null;
	createDate?: string | number | null;
	totalAmount?: string | number | null;
	saleAmount?: string | number | null;
	/** Target raise amount (quote) */
	raisedAmount?: string | number | null;
	decimals?: number | null;
	quoteAddress?: string | null;
	quoteDecimals?: number | null;
	pairAddress?: string | null;
	pancakeVersion?: string | number | null;
	userAddress?: string | null;
	twitterUrl?: string | null;
	telegramUrl?: string | null;
	webUrl?: string | null;
};

/** Display pair: token / quote */
export function tokenPairLabel(token: {
	shortName?: string | null;
	name?: string | null;
	symbol?: string | null;
}): string {
	const base = (token.shortName || token.name || "TOKEN").trim();
	const quote = (token.symbol || "BNB").trim();
	return `${base} / ${quote}`;
}

function explorerUrl(address: string) {
	return `https://bscscan.com/token/${address}`;
}

export function TokenHeader({
	token,
	ticker,
	livePrice,
}: {
	token: TokenHeaderModel;
	ticker?: TokenHeaderTicker | null;
	livePrice?: string | null;
}) {
	const { t, href } = useI18n();
	const [copied, setCopied] = useState<"token" | "dev" | null>(null);
	const flags = useTokenTradeFlags(token.address);
	const hasTax = flags.feeRateBuy > 0 || flags.feeRateSell > 0;
	const pair = tokenPairLabel(token);

	const copyText = async (value: string, kind: "token" | "dev") => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(kind);
			window.setTimeout(() => setCopied(null), 1200);
		} catch {
			setCopied(null);
		}
	};

	return (
		<header className="token-header token-header--identity">
			<div className="token-header-main">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={imageUrl(token.image)}
					alt=""
					className="token-img xl"
				/>
				<div className="token-header-identity">
					<div className="token-title-row">
						<h1
							id="token-header-title"
							className="token-title"
							title={token.name}
						>
							{pair}
						</h1>
						<div className="token-title-badges">
							{flags.antiSniperEnabled ? <AntiSniperFeeTip /> : null}
							{hasTax ? (
								<Link
									href={href(`/token/${token.address}/tax`)}
									className="token-tax-badge"
								>
									{t("token.tax")} {formatTaxPct(flags.feeRateBuy)}% /{" "}
									{formatTaxPct(flags.feeRateSell)}%
								</Link>
							) : null}
						</div>
					</div>

					<div className="token-meta-row">
						<span className="token-age">{formatAge(token.createDate)}</span>
						<button
							type="button"
							className={`token-addr${copied === "token" ? " copied" : ""}`}
							onClick={() => copyText(token.address, "token")}
							title={token.address}
							aria-label={t("token.copyContract")}
						>
							{formatAddress(token.address, 4)}
							<CopyIcon />
						</button>
						{token.userAddress ? (
							<button
								type="button"
								className={`token-addr${copied === "dev" ? " copied" : ""}`}
								onClick={() => copyText(token.userAddress as string, "dev")}
								title={token.userAddress}
								aria-label={t("token.copyDeveloper")}
							>
								{t("token.developer")} {formatAddress(token.userAddress, 3)}
								<CopyIcon />
							</button>
						) : null}
					</div>

					<div className="token-links">
						<a
							href={explorerUrl(token.address)}
							target="_blank"
							rel="noreferrer"
						>
							BscScan
						</a>
						{token.twitterUrl ? (
							<a href={token.twitterUrl} target="_blank" rel="noreferrer">
								X
							</a>
						) : null}
						{token.telegramUrl ? (
							<a href={token.telegramUrl} target="_blank" rel="noreferrer">
								Telegram
							</a>
						) : null}
						{token.webUrl ? (
							<a href={token.webUrl} target="_blank" rel="noreferrer">
								Web
							</a>
						) : null}
					</div>
				</div>
				<TokenMetrics
					token={token}
					ticker={ticker}
					livePrice={livePrice}
					compact
				/>
			</div>
		</header>
	);
}
