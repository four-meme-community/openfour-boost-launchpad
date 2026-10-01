/**
 * Detail-page safety/fee flags: on-chain antiSniper + buy/sell tax rates.
 */
"use client";

import { useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
import { readContract } from "wagmi/actions";
import openFourCoreAbi from "@/abi/open-four-core.json";
import { getActiveChain } from "@/lib/chain";
import { loadContracts } from "@/lib/open-four";
import { readTokenTaxBps } from "@/lib/zap-trade";
import { wagmiConfig } from "@/lib/wagmi";

export type TokenTradeFlags = {
	antiSniperEnabled: boolean;
	/** Buy tax % (e.g. 1 = 1%) */
	feeRateBuy: number;
	/** Sell tax % */
	feeRateSell: number;
	loading: boolean;
};

const EMPTY: TokenTradeFlags = {
	antiSniperEnabled: false,
	feeRateBuy: 0,
	feeRateSell: 0,
	loading: false,
};

/** buyFeeRate on-chain unit: 100 = 1% */
function rateToPercent(raw: number): number {
	if (!Number.isFinite(raw) || raw <= 0) return 0;
	return raw / 100;
}

export function useTokenTradeFlags(
	tokenAddress?: string | null,
): TokenTradeFlags {
	const [state, setState] = useState<TokenTradeFlags>({
		...EMPTY,
		loading: !!tokenAddress && isAddress(tokenAddress),
	});

	useEffect(() => {
		if (!tokenAddress || !isAddress(tokenAddress)) {
			setState(EMPTY);
			return;
		}

		let cancelled = false;
		setState((prev) => ({ ...prev, loading: true }));

		(async () => {
			try {
				const [contracts, tax] = await Promise.all([
					loadContracts(),
					readTokenTaxBps(tokenAddress as Address),
				]);

				let antiSniperEnabled = false;
				try {
					const row = await readContract(wagmiConfig, {
						address: contracts.OpenFourCore,
						abi: openFourCoreAbi,
						functionName: "tokens",
						args: [tokenAddress as Address],
						chainId: getActiveChain().id,
					});
					const tuple = row as readonly unknown[];
					antiSniperEnabled = Boolean(tuple?.[19]);
				} catch {
					antiSniperEnabled = false;
				}

				if (cancelled) return;
				setState({
					antiSniperEnabled,
					feeRateBuy: rateToPercent(tax.buy),
					feeRateSell: rateToPercent(tax.sell),
					loading: false,
				});
			} catch {
				if (!cancelled) setState(EMPTY);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [tokenAddress]);

	return state;
}
