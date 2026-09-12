/**
 * Tax config: fully on-chain, branched by the template from `descriptor()`.
 *
 * Background: `lib/tax-api.ts` `fetchTaxConfig` (REST `token_tax`) often returns
 * no `data` even for taxed tokens. On-chain checks (see plan docs) show tax config
 * lives on the token contract and is simply not mirrored to that REST endpoint.
 * This module bypasses REST and reads the token contract directly.
 *
 * Support varies by the six templates (not equally complete):
 * - token.tax / token.tax.stock (TaxToken / Stock4TaxToken): identical ABI —
 *   buy/sell rates, burn/LP/holders/recipient splits, claimable amount, and claim
 *   all read/call the token itself; no helper contract needed.
 * - token.strategy_tax (StrategyTaxToken): buy/sell rates and min balance are
 *   reliable on the token; split details live on a separate `taxStrategy` with
 *   4 implementations — only StockDividendTaxStrategy field shape is recognized;
 *   the other 3 show no split details.
 * - token.creator_rewards (CreatorRewardsToken): different model — no burn/LP/
 *   holder dividends; creator/protocol split only; fees are pushed automatically
 *   (no user claim).
 * - token.uni / token.standard: no tax.
 * - descriptor() failure or unknown tag: caller falls back to REST.
 */
"use client";

import { readContracts } from "wagmi/actions";
import type { Address } from "viem";
import { readTokenDescriptor } from "./token-descriptor";
import type { TokenTaxConfig } from "./tax-api";
import { wagmiConfig } from "./wagmi";

const TAX_TOKEN_ABI = [
	{ type: "function", name: "buyFeeRate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
	{ type: "function", name: "sellFeeRate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
	{ type: "function", name: "rateFounder", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
	{ type: "function", name: "rateHolder", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
	{ type: "function", name: "rateBurn", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
	{ type: "function", name: "rateLiquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
	{ type: "function", name: "minShare", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
	{ type: "function", name: "founder", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
	{ type: "function", name: "tokenBurned", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
	/** Lifetime tax collected (quote) — matches on-chain `totalTaxCollected` comment */
	{ type: "function", name: "totalTaxCollected", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
	/** Collected but undistributed tax (quote) — on-chain `feeAccumulated` is "undistributed" */
	{ type: "function", name: "feeAccumulated", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const STRATEGY_TOKEN_ABI = [
	{ type: "function", name: "buyFeeRate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
	{ type: "function", name: "sellFeeRate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
	{ type: "function", name: "minShare", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
	{ type: "function", name: "taxStrategy", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

/** Only StockDividendTaxStrategy is recognized (other 3 strategy shapes unsupported) */
const STOCK_DIVIDEND_STRATEGY_ABI = [
	{ type: "function", name: "holderBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
	{ type: "function", name: "burnBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
	{ type: "function", name: "liquidityBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
	{ type: "function", name: "distributeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
	{
		type: "function",
		name: "stockClaimable",
		stateMutability: "view",
		inputs: [{ name: "account", type: "address" }],
		outputs: [{ type: "uint256" }],
	},
] as const;

const CREATOR_REWARDS_ABI = [
	{ type: "function", name: "creator", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
	{
		/** Declared `external` (not view) on-chain, but we only eth_call — no state change */
		type: "function",
		name: "resolveFeeRate",
		stateMutability: "view",
		inputs: [{ name: "token", type: "address" }],
		outputs: [
			{ name: "rateProtocol", type: "uint256" },
			{ name: "rateCreator", type: "uint256" },
		],
	},
] as const;

export const CLAIMABLE_FEE_ABI = [
	{
		type: "function",
		name: "claimableFee",
		stateMutability: "view",
		inputs: [{ name: "account", type: "address" }],
		outputs: [{ type: "uint256" }],
	},
] as const;

export const CLAIM_FEE_ABI = [
	{ type: "function", name: "claimFee", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

/** Lifetime claimed total — single view call, not event log scanning */
const CLAIMED_FEE_ABI = [
	{
		type: "function",
		name: "claimedFee",
		stateMutability: "view",
		inputs: [{ name: "account", type: "address" }],
		outputs: [{ type: "uint256" }],
	},
] as const;

export type OnchainTaxInfo =
	| {
			kind: "tax";
			tokenAddress: Address;
			buyFeeRate: number;
			sellFeeRate: number;
			allocation: TokenTaxConfig;
			/** Lifetime tax collected (quote) */
			totalTaxCollected: bigint;
			/** Collected but undistributed tax (quote) */
			feeAccumulated: bigint;
	  }
	| {
			kind: "strategy";
			tokenAddress: Address;
			buyFeeRate: number;
			sellFeeRate: number;
			strategyAddress: Address;
			/** Set only for known StockDividendTaxStrategy; other strategies unsupported */
			allocation: TokenTaxConfig | null;
	  }
	| {
			kind: "creator_rewards";
			tokenAddress: Address;
			combinedFeeRate: number;
			creator: Address;
	  }
	| { kind: "none" }
	| { kind: "unknown" };

function bpsToPct(bps: number): number {
	return bps / 100;
}

export async function readOnchainTaxInfo(
	tokenAddress: Address,
): Promise<OnchainTaxInfo> {
	const descriptor = await readTokenDescriptor(tokenAddress);
	if (!descriptor) return { kind: "unknown" };

	if (descriptor.tag === "token.tax" || descriptor.tag === "token.tax.stock") {
		const results = await readContracts(wagmiConfig, {
			contracts: TAX_TOKEN_ABI.map((item) => ({
				address: tokenAddress,
				abi: [item],
				functionName: item.name,
			})),
			allowFailure: true,
		});
		const [
			buyFeeRate,
			sellFeeRate,
			rateFounder,
			rateHolder,
			rateBurn,
			rateLiquidity,
			minShare,
			founder,
			tokenBurned,
			totalTaxCollected,
			feeAccumulated,
		] = results.map((r) => (r.status === "success" ? r.result : undefined));

		return {
			kind: "tax",
			tokenAddress,
			buyFeeRate: Number(buyFeeRate ?? 0),
			sellFeeRate: Number(sellFeeRate ?? 0),
			allocation: {
				feeRate: Number(buyFeeRate ?? 0),
				feeRateSell: Number(sellFeeRate ?? 0),
				recipientRate: Number(rateFounder ?? 0),
				burnRate: Number(rateBurn ?? 0),
				divideRate: Number(rateHolder ?? 0),
				liquidityRate: Number(rateLiquidity ?? 0),
				recipientAddress: (founder as Address | undefined) ?? undefined,
				minSharing: (minShare as bigint | undefined)?.toString(),
				feeBurn: (tokenBurned as bigint | undefined)?.toString(),
			},
			totalTaxCollected: (totalTaxCollected as bigint | undefined) ?? 0n,
			feeAccumulated: (feeAccumulated as bigint | undefined) ?? 0n,
		};
	}

	if (descriptor.tag === "token.strategy_tax") {
		const results = await readContracts(wagmiConfig, {
			contracts: STRATEGY_TOKEN_ABI.map((item) => ({
				address: tokenAddress,
				abi: [item],
				functionName: item.name,
			})),
			allowFailure: true,
		});
		const [buyFeeRate, sellFeeRate, , strategyAddress] = results.map((r) =>
			r.status === "success" ? r.result : undefined,
		);

		let allocation: TokenTaxConfig | null = null;
		if (strategyAddress) {
			const strategyResults = await readContracts(wagmiConfig, {
				contracts: STOCK_DIVIDEND_STRATEGY_ABI.slice(0, 4).map((item) => ({
					address: strategyAddress as Address,
					abi: [item],
					functionName: item.name,
				})),
				allowFailure: true,
			});
			const allOk = strategyResults.every((r) => r.status === "success");
			if (allOk) {
				const [holderBps, burnBps, liquidityBps, distributeBps] = strategyResults.map(
					(r) => Number(r.result),
				);
				allocation = {
					divideRate: bpsToPct(holderBps),
					burnRate: bpsToPct(burnBps),
					liquidityRate: bpsToPct(liquidityBps),
					recipientRate: bpsToPct(distributeBps),
				};
			}
		}

		return {
			kind: "strategy",
			tokenAddress,
			buyFeeRate: Number(buyFeeRate ?? 0),
			sellFeeRate: Number(sellFeeRate ?? 0),
			strategyAddress: strategyAddress as Address,
			allocation,
		};
	}

	if (descriptor.tag === "token.creator_rewards") {
		const results = await readContracts(wagmiConfig, {
			contracts: [
				{ address: tokenAddress, abi: [CREATOR_REWARDS_ABI[0]], functionName: "creator" },
				{
					address: tokenAddress,
					abi: [CREATOR_REWARDS_ABI[1]],
					functionName: "resolveFeeRate",
					args: [tokenAddress],
				},
			],
			allowFailure: true,
		});
		const creator = results[0].status === "success" ? (results[0].result as Address) : undefined;
		const rates =
			results[1].status === "success"
				? (results[1].result as readonly [bigint, bigint])
				: undefined;
		const combined = rates ? Number(rates[0]) + Number(rates[1]) : 0;

		return {
			kind: "creator_rewards",
			tokenAddress,
			combinedFeeRate: combined,
			creator: creator ?? ("0x0000000000000000000000000000000000000000" as Address),
		};
	}

	if (descriptor.tag === "token.uni" || descriptor.tag === "token.standard") {
		return { kind: "none" };
	}

	return { kind: "unknown" };
}

/** Reliable only for kind === "tax" — read token claimableFee directly, no helper */
export async function readOnchainClaimable(
	info: OnchainTaxInfo,
	account: Address,
): Promise<bigint | null> {
	if (info.kind === "tax") {
		try {
			const [result] = await readContracts(wagmiConfig, {
				contracts: [
					{
						address: info.tokenAddress,
						abi: CLAIMABLE_FEE_ABI,
						functionName: "claimableFee",
						args: [account],
					},
				],
				allowFailure: true,
			});
			return result.status === "success" ? (result.result as bigint) : null;
		} catch {
			return null;
		}
	}
	if (info.kind === "strategy" && info.allocation) {
		try {
			const [result] = await readContracts(wagmiConfig, {
				contracts: [
					{
						address: info.strategyAddress,
						abi: STOCK_DIVIDEND_STRATEGY_ABI.slice(4),
						functionName: "stockClaimable",
						args: [account],
					},
				],
				allowFailure: true,
			});
			return result.status === "success" ? (result.result as bigint) : null;
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * Lifetime claimed amount — reliable only for kind === "tax". Single view call
 * (`claimedFee(account)`), not event scanning — fits the "no direct event query"
 * constraint; tradeoff is a total only, not per-claim details.
 */
export async function readOnchainClaimedTotal(
	info: OnchainTaxInfo,
	account: Address,
): Promise<bigint | null> {
	if (info.kind !== "tax") return null;
	try {
		const [result] = await readContracts(wagmiConfig, {
			contracts: [
				{
					address: info.tokenAddress,
					abi: CLAIMED_FEE_ABI,
					functionName: "claimedFee",
					args: [account],
				},
			],
			allowFailure: true,
		});
		return result.status === "success" ? (result.result as bigint) : null;
	} catch {
		return null;
	}
}
