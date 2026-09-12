/**
 * Right floating docker: market metrics + trade panel.
 * Top title shows token / quote only after scrolling past the main header.
 */
"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import {
	tokenPairLabel,
	type TokenHeaderModel,
	type TokenHeaderTicker,
} from "@/components/token-header";
import { TokenInfoCard } from "@/components/token-info-card";
import { TradePanel } from "@/components/trade-panel";
import type { TokenZapMeta } from "@/lib/zap-route";

export function TradeDocker({
	token,
	ticker,
	livePrice,
	tokenAddress,
	onDex,
	tokenMeta,
}: {
	token: TokenHeaderModel;
	ticker?: TokenHeaderTicker | null;
	livePrice?: string | null;
	tokenAddress: Address;
	onDex: boolean;
	tokenMeta?: TokenZapMeta;
}) {
	const [showPair, setShowPair] = useState(false);
	const pair = tokenPairLabel(token);

	useEffect(() => {
		const title = document.getElementById("token-header-title");
		if (!title || typeof IntersectionObserver === "undefined") {
			setShowPair(false);
			return;
		}

		const io = new IntersectionObserver(
			([entry]) => {
				setShowPair(!entry.isIntersecting);
			},
			{
				root: null,
				threshold: 0,
				rootMargin: "0px 0px 0px 0px",
			},
		);
		io.observe(title);
		return () => io.disconnect();
	}, [token.address, pair]);

	return (
		<aside className="trade-docker">
			<div className="trade-docker-card">
				{showPair ? (
					<div className="trade-docker-pair" title={token.name}>
						{pair}
					</div>
				) : null}
				<TradePanel
					tokenAddress={tokenAddress}
					quoteSymbol={token.symbol || "BNB"}
					tokenSymbol={
						token.shortName || token.name || token.symbol || "TOKEN"
					}
					onDex={onDex}
					tokenMeta={tokenMeta}
				/>
			</div>
			<TokenInfoCard
				token={token}
				ticker={ticker}
				livePrice={livePrice}
			/>
		</aside>
	);
}
