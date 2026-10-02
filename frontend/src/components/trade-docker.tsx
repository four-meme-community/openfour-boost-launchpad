/**
 * Right docker: trade panel + token info.
 */
"use client";

import type { Address } from "viem";
import type {
	TokenHeaderModel,
	TokenHeaderTicker,
} from "@/components/token-header";
import { TokenInfoCard } from "@/components/token-info-card";
import { TradePanel } from "@/components/trade-panel";
import { currentNativeQuoteSymbol } from "@/lib/chain";
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
	return (
		<aside className="trade-docker">
			<div className="trade-docker-card">
				<TradePanel
					tokenAddress={tokenAddress}
					quoteSymbol={token.symbol || currentNativeQuoteSymbol()}
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
