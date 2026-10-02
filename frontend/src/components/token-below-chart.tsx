/**
 * Below chart: fills / holders tabs.
 */
"use client";

import { useState } from "react";
import { TokenFills } from "@/components/token-fills";
import { TokenHolders } from "@/components/token-holders";
import { useI18n } from "@/i18n/provider";

type Tab = "fills" | "holders";

export function TokenBelowChart({
	tokenId,
	totalAmount,
	creator,
	tokenAddress,
	quoteSymbol,
	quoteLabel,
	holderCount,
}: {
	tokenId: number;
	totalAmount?: string | number | null;
	creator?: string | null;
	tokenAddress?: string | null;
	quoteSymbol?: string;
	/** User-facing quote ticker (config.nativeSymbol) */
	quoteLabel?: string;
	holderCount?: number | null;
}) {
	const { t } = useI18n();
	const [tab, setTab] = useState<Tab>("fills");

	return (
		<section className="token-below">
			<div className="token-below-tabs" role="tablist">
				<button
					type="button"
					role="tab"
					aria-selected={tab === "fills"}
					className={`token-below-tab${tab === "fills" ? " active" : ""}`}
					onClick={() => setTab("fills")}
				>
					{t("fills.trades")}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === "holders"}
					className={`token-below-tab${tab === "holders" ? " active" : ""}`}
					onClick={() => setTab("holders")}
				>
					{t("market.holders")}
					{holderCount != null ? (
						<span className="token-below-count">
							{Number(holderCount).toLocaleString()}
						</span>
					) : null}
				</button>
			</div>

			<div className="token-below-panel">
				{tab === "fills" ? (
					<TokenFills
						tokenId={tokenId}
						quoteSymbol={quoteLabel || quoteSymbol}
					/>
				) : (
					<TokenHolders
						tokenId={tokenId}
						totalAmount={totalAmount}
						creator={creator}
						tokenAddress={tokenAddress}
					/>
				)}
			</div>
		</section>
	);
}
