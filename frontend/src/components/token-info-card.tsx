/**
 * Right Token Info: reuse detail-page token and ticker data.
 */
"use client";

import { useState } from "react";
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
import { formatAddress, formatCompact, formatNum } from "@/lib/format";
import { isTokenOnDex } from "@/lib/meme-api";
import { useI18n } from "@/i18n/provider";

export function TokenInfoCard({
	token,
	ticker,
	livePrice,
}: {
	token: TokenHeaderModel;
	ticker?: TokenHeaderTicker | null;
	livePrice?: string | null;
}) {
	const { t } = useI18n();
	const [copied, setCopied] = useState(false);
	const marketCap = deriveLiveMarketCap(
		livePrice,
		ticker?.price,
		ticker?.marketCap,
		token.totalAmount,
	);
	const onDex = isTokenOnDex(ticker?.status ?? token.status);
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

	const copyAddress = async () => {
		try {
			await navigator.clipboard.writeText(token.address);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1200);
		} catch {
			setCopied(false);
		}
	};

	return (
		<section className="token-info-card">
			<h2>{t("token.info")}</h2>
			<dl>
				<dt>{t("token.name")}</dt>
				<dd>{token.name || "—"}</dd>

				<dt>{t("token.symbol")}</dt>
				<dd>{token.shortName || "—"}</dd>

				<dt>{t("token.contract")}</dt>
				<dd>
					<button
						type="button"
						className={`token-info-copy${copied ? " copied" : ""}`}
						onClick={copyAddress}
						title={token.address}
						aria-label={t("token.copyContract")}
					>
						{formatAddress(token.address, 4)}
						<CopyIcon />
					</button>
				</dd>

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
		</section>
	);
}
