/**
 * OpenFour liquidity:
 * - Bonding: OpenFourTools curve snapshot quote liquidity × quote USD × 2
 * - External: sum of USD value of both DEX pair reserves
 */
"use client";

import { useEffect, useState } from "react";
import {
	erc20Abi,
	formatUnits,
	isAddress,
	zeroAddress,
	type Address,
} from "viem";
import { readContract } from "wagmi/actions";
import openFourToolsAbi from "@/abi/open-four-tools.json";
import { loadContracts } from "@/lib/open-four";
import { fetchQuoteTickerPrice } from "@/lib/meme-api";
import { wagmiConfig } from "@/lib/wagmi";
import { WBNB } from "@/lib/dex-v2";

const V2_PAIR_ABI = [
	{
		type: "function",
		name: "getReserves",
		stateMutability: "view",
		inputs: [],
		outputs: [
			{ name: "reserve0", type: "uint112" },
			{ name: "reserve1", type: "uint112" },
			{ name: "blockTimestampLast", type: "uint32" },
		],
	},
	{
		type: "function",
		name: "token0",
		stateMutability: "view",
		inputs: [],
		outputs: [{ name: "", type: "address" }],
	},
] as const;

type Params = {
	onDex: boolean;
	tokenAddress: string;
	tokenDecimals?: number | null;
	quoteSymbol: string;
	quoteAddress?: string | null;
	quoteDecimals?: number | null;
	pairAddress?: string | null;
	pancakeVersion?: string | number | null;
	tokenPrice?: string | number | null;
};

async function readInternalLiquidity(
	tokenAddress: Address,
	quoteDecimals: number,
	quoteUsd: number,
): Promise<number> {
	const contracts = await loadContracts();
	const snapshot = (await readContract(wagmiConfig, {
		address: contracts.OpenFourTools,
		abi: openFourToolsAbi,
		functionName: "getCurveLiquiditySnapshot",
		args: [tokenAddress],
	})) as {
		available?: boolean;
		currentQuoteLiquidity?: bigint;
	};

	if (!snapshot?.available) return 0;
	const quoteLiquidity = Number(
		formatUnits(snapshot.currentQuoteLiquidity || 0n, quoteDecimals),
	);
	return quoteLiquidity * quoteUsd * 2;
}

async function readExternalLiquidity(
	params: Params,
	quoteUsd: number,
): Promise<number | null> {
	if (
		!params.pairAddress ||
		!isAddress(params.pairAddress) ||
		!params.quoteAddress ||
		!isAddress(params.quoteAddress)
	) {
		return null;
	}

	const pair = params.pairAddress as Address;
	const token = params.tokenAddress as Address;
	const quote =
		params.quoteAddress.toLowerCase() === zeroAddress
			? WBNB
			: (params.quoteAddress as Address);
	const tokenDecimals = params.tokenDecimals ?? 18;
	const quoteDecimals = params.quoteDecimals ?? 18;
	const tokenUsd = Number(params.tokenPrice) || 0;

	let tokenReserve = 0;
	let quoteReserve = 0;

	if (Number(params.pancakeVersion) === 3) {
		const [tokenRaw, quoteRaw] = await Promise.all([
			readContract(wagmiConfig, {
				address: token,
				abi: erc20Abi,
				functionName: "balanceOf",
				args: [pair],
			}),
			readContract(wagmiConfig, {
				address: quote,
				abi: erc20Abi,
				functionName: "balanceOf",
				args: [pair],
			}),
		]);
		tokenReserve = Number(formatUnits(tokenRaw, tokenDecimals));
		quoteReserve = Number(formatUnits(quoteRaw, quoteDecimals));
	} else {
		const [reserves, token0] = await Promise.all([
			readContract(wagmiConfig, {
				address: pair,
				abi: V2_PAIR_ABI,
				functionName: "getReserves",
			}),
			readContract(wagmiConfig, {
				address: pair,
				abi: V2_PAIR_ABI,
				functionName: "token0",
			}),
		]);
		const tokenIs0 = token0.toLowerCase() === token.toLowerCase();
		const tokenRaw = tokenIs0 ? reserves[0] : reserves[1];
		const quoteRaw = tokenIs0 ? reserves[1] : reserves[0];
		tokenReserve = Number(formatUnits(tokenRaw, tokenDecimals));
		quoteReserve = Number(formatUnits(quoteRaw, quoteDecimals));
	}

	return tokenReserve * tokenUsd + quoteReserve * quoteUsd;
}

export function useTokenLiquidity(params: Params): {
	liquidity: number | null;
	loading: boolean;
} {
	const [liquidity, setLiquidity] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!isAddress(params.tokenAddress)) {
			setLiquidity(null);
			setLoading(false);
			return;
		}

		let cancelled = false;
		const refresh = async () => {
			if (document.visibilityState === "hidden") return;
			try {
				const quoteUsd = await fetchQuoteTickerPrice(params.quoteSymbol);
				const next = params.onDex
					? await readExternalLiquidity(params, quoteUsd)
					: await readInternalLiquidity(
							params.tokenAddress as Address,
							params.quoteDecimals ?? 18,
							quoteUsd,
						);
				if (!cancelled) {
					setLiquidity(next != null && Number.isFinite(next) ? next : null);
				}
			} catch {
				if (!cancelled) setLiquidity(null);
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		setLoading(true);
		void refresh();
		const timer = window.setInterval(refresh, params.onDex ? 30_000 : 5_000);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [
		params.onDex,
		params.tokenAddress,
		params.tokenDecimals,
		params.quoteSymbol,
		params.quoteAddress,
		params.quoteDecimals,
		params.pairAddress,
		params.pancakeVersion,
		params.tokenPrice,
	]);

	return { liquidity, loading };
}
