/**
 * OpenFour ZapRouter external quote / trade (aligned with meme-launcher use-zap-trade).
 * Native BNB ↔ meme token only (ViaBridge).
 */
"use client";

import {
	readContract,
	readContracts,
	simulateContract,
	waitForTransactionReceipt,
	writeContract,
} from "wagmi/actions";
import {
	erc20Abi,
	isAddress,
	zeroAddress,
	type Address,
	type Hex,
} from "viem";
import { getActiveChain } from "./chain";
import { publicEnv } from "./env";
import { wagmiConfig } from "./wagmi";
import { ZAP_DEX_TYPE, type ZapRoute } from "./zap-route";
import { writeWithGas, type TxGasOverrides } from "./tx-gas";

const ZERO = 0n;
const DEADLINE_SECONDS = 300;

const OPEN_FOUR_CORE_ZAP_ABI = [
	{
		type: "function",
		name: "zapRouter",
		stateMutability: "view",
		inputs: [],
		outputs: [{ name: "", type: "address" }],
	},
] as const;

const TAX_RATE_ABI = [
	{
		type: "function",
		name: "buyFeeRate",
		stateMutability: "view",
		inputs: [],
		outputs: [{ name: "", type: "uint256" }],
	},
	{
		type: "function",
		name: "sellFeeRate",
		stateMutability: "view",
		inputs: [],
		outputs: [{ name: "", type: "uint256" }],
	},
] as const;

export const ZAP_ROUTER_ABI = [
	{
		type: "function",
		name: "quoteNativeToTokenViaBridge",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "bridgeToken", type: "address" },
			{ name: "tokenOut", type: "address" },
			{ name: "finalDexId", type: "uint8" },
			{ name: "finalFee", type: "uint24" },
			{ name: "amountIn", type: "uint256" },
		],
		outputs: [
			{ name: "amountOut", type: "uint256" },
			{ name: "midTokens", type: "address[]" },
		],
	},
	{
		type: "function",
		name: "quoteTokenToNativeViaBridge",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "tokenIn", type: "address" },
			{ name: "bridgeToken", type: "address" },
			{ name: "firstDexId", type: "uint8" },
			{ name: "firstFee", type: "uint24" },
			{ name: "amountIn", type: "uint256" },
		],
		outputs: [
			{ name: "amountOut", type: "uint256" },
			{ name: "midTokens", type: "address[]" },
		],
	},
	{
		type: "function",
		name: "swapNativeToTokenViaBridge",
		stateMutability: "payable",
		inputs: [
			{ name: "bridgeToken", type: "address" },
			{ name: "tokenOut", type: "address" },
			{ name: "finalDexId", type: "uint8" },
			{ name: "finalFee", type: "uint24" },
			{ name: "recipient", type: "address" },
			{ name: "minAmountOut", type: "uint256" },
			{ name: "deadline", type: "uint256" },
		],
		outputs: [
			{ name: "amountOut", type: "uint256" },
			{ name: "midTokens", type: "address[]" },
		],
	},
	{
		type: "function",
		name: "swapNativeToTaxToken",
		stateMutability: "payable",
		inputs: [
			{ name: "bridgeToken", type: "address" },
			{ name: "tokenOut", type: "address" },
			{ name: "finalDexId", type: "uint8" },
			{ name: "finalFee", type: "uint24" },
			{ name: "recipient", type: "address" },
			{ name: "minAmountOut", type: "uint256" },
			{ name: "deadline", type: "uint256" },
		],
		outputs: [
			{ name: "amountOut", type: "uint256" },
			{ name: "midTokens", type: "address[]" },
		],
	},
	{
		type: "function",
		name: "swapTokenToNativeViaBridge",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "tokenIn", type: "address" },
			{ name: "bridgeToken", type: "address" },
			{ name: "firstDexId", type: "uint8" },
			{ name: "firstFee", type: "uint24" },
			{ name: "recipient", type: "address" },
			{ name: "amountIn", type: "uint256" },
			{ name: "minAmountOut", type: "uint256" },
			{ name: "deadline", type: "uint256" },
		],
		outputs: [
			{ name: "amountOut", type: "uint256" },
			{ name: "midTokens", type: "address[]" },
		],
	},
	{
		type: "function",
		name: "swapTaxTokenToNative",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "tokenIn", type: "address" },
			{ name: "bridgeToken", type: "address" },
			{ name: "firstDexId", type: "uint8" },
			{ name: "firstFee", type: "uint24" },
			{ name: "recipient", type: "address" },
			{ name: "amountIn", type: "uint256" },
			{ name: "minAmountOut", type: "uint256" },
			{ name: "deadline", type: "uint256" },
		],
		outputs: [
			{ name: "amountOut", type: "uint256" },
			{ name: "midTokens", type: "address[]" },
		],
	},
] as const;

export type ZapQuote = {
	source: "zap";
	amountIn: bigint;
	amountOut: bigint;
};

function zapDebug(event: string, details: unknown) {
	if (publicEnv.zapDebug) {
		console.info(`[ZapTrade:${event}]`, details);
	}
}

function deadline() {
	return BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
}

function slippageBips(slippage: number) {
	return BigInt(
		Math.max(0, Math.min(10000, Math.floor(Number(slippage || 0) * 100))),
	);
}

function minAfterSlippage(amount: bigint, slippage: number) {
	return (amount * (10000n - slippageBips(slippage))) / 10000n;
}

function afterTax(amount: bigint, taxBps: number) {
	const bips = BigInt(Math.max(0, Math.min(10000, taxBps)));
	return (amount * (10000n - bips)) / 10000n;
}

export async function resolveZapRouterAddress(
	coreAddress?: Address | null,
): Promise<Address | null> {
	const envAddr = publicEnv.zapRouterAddress;
	if (envAddr && isAddress(envAddr) && envAddr !== zeroAddress) {
		return envAddr as Address;
	}
	if (!coreAddress || !isAddress(coreAddress)) return null;
	try {
		const router = (await readContract(wagmiConfig, {
			address: coreAddress,
			abi: OPEN_FOUR_CORE_ZAP_ABI,
			functionName: "zapRouter",
			chainId: getActiveChain().id,
		})) as Address;
		if (!isAddress(router) || router === zeroAddress) return null;
		zapDebug("router:resolved", { coreAddress, router });
		return router;
	} catch (error) {
		zapDebug("router:error", { coreAddress, error });
		return null;
	}
}

export async function readTokenTaxBps(tokenAddress: Address): Promise<{
	buy: number;
	sell: number;
}> {
	try {
		const chainId = getActiveChain().id;
		const results = await readContracts(wagmiConfig, {
			contracts: [
				{
					address: tokenAddress,
					abi: [TAX_RATE_ABI[0]],
					functionName: "buyFeeRate",
					chainId,
				},
				{
					address: tokenAddress,
					abi: [TAX_RATE_ABI[1]],
					functionName: "sellFeeRate",
					chainId,
				},
			],
			allowFailure: true,
		});
		return {
			buy: Number(results[0]?.result ?? 0),
			sell: Number(results[1]?.result ?? 0),
		};
	} catch {
		return { buy: 0, sell: 0 };
	}
}

export function canUseZap(params: {
	zapRouter: Address | null;
	token: Address;
	route: ZapRoute | null;
}): boolean {
	const { zapRouter, token, route } = params;
	return (
		!!zapRouter &&
		isAddress(zapRouter) &&
		zapRouter !== zeroAddress &&
		isAddress(token) &&
		!!route &&
		isAddress(route.bridgeToken) &&
		route.bridgeToken !== zeroAddress &&
		Number(route.dexId) > 0
	);
}

/** exact-in: buy=BNB→token, sell=token→BNB */
export async function quoteZapExactIn(params: {
	account?: Address;
	zapRouter: Address;
	token: Address;
	route: ZapRoute;
	side: "buy" | "sell";
	amountIn: bigint;
	buyTaxBps?: number;
	sellTaxBps?: number;
}): Promise<ZapQuote | null> {
	const {
		account,
		zapRouter,
		token,
		route,
		side,
		amountIn,
		buyTaxBps = 0,
		sellTaxBps = 0,
	} = params;
	if (amountIn <= ZERO) return null;

	try {
		const isBuy = side === "buy";
		const functionName = isBuy
			? "quoteNativeToTokenViaBridge"
			: "quoteTokenToNativeViaBridge";
		const quotedInput =
			!isBuy && Number(route.dexType) === ZAP_DEX_TYPE.V2
				? afterTax(amountIn, sellTaxBps)
				: amountIn;
		const args = isBuy
			? ([
					route.bridgeToken,
					token,
					route.dexId,
					route.fee,
					amountIn,
				] as const)
			: ([
					token,
					route.bridgeToken,
					route.dexId,
					route.fee,
					quotedInput,
				] as const);

		zapDebug("quote:request", { functionName, args, side });
		const { result } = await simulateContract(wagmiConfig, {
			...(account ? { account } : {}),
			address: zapRouter,
			abi: ZAP_ROUTER_ABI,
			functionName,
			args: [...args],
		});
		let amountOut = (result as [bigint, Address[]])[0] || ZERO;
		if (isBuy && Number(route.dexType) === ZAP_DEX_TYPE.V2) {
			amountOut = afterTax(amountOut, buyTaxBps);
		}
		if (amountOut <= ZERO) return null;
		const quote: ZapQuote = {
			source: "zap",
			amountIn,
			amountOut,
		};
		zapDebug("quote:success", { quote });
		return quote;
	} catch (error) {
		zapDebug("quote:error", { error });
		return null;
	}
}

async function ensureAllowance(params: {
	token: Address;
	owner: Address;
	spender: Address;
	amount: bigint;
}) {
	const chainId = getActiveChain().id;
	const allowance = await readContract(wagmiConfig, {
		address: params.token,
		abi: erc20Abi,
		functionName: "allowance",
		args: [params.owner, params.spender],
		chainId,
	});
	if (allowance >= params.amount) return;
	const { request } = await simulateContract(wagmiConfig, {
		account: params.owner,
		abi: erc20Abi,
		address: params.token,
		functionName: "approve",
		args: [params.spender, params.amount],
	});
	const hash = await writeContract(wagmiConfig, request);
	await waitForTransactionReceipt(wagmiConfig, { hash });
}

export async function executeZapExactIn(params: {
	account: Address;
	zapRouter: Address;
	token: Address;
	route: ZapRoute;
	side: "buy" | "sell";
	quote: ZapQuote;
	slippage: number;
	buyTaxBps?: number;
	gasPrice?: bigint;
	gas?: bigint;
}): Promise<Hex> {
	const {
		account,
		zapRouter,
		token,
		route,
		side,
		quote,
		slippage,
		buyTaxBps = 0,
	} = params;

	const dl = deadline();
	const minOut = minAfterSlippage(quote.amountOut, slippage);
	const gas: TxGasOverrides = {
		gasPrice: params.gasPrice,
		gas: params.gas,
	};

	if (side === "buy") {
		const useTax =
			Number(route.dexType) === ZAP_DEX_TYPE.V2 && buyTaxBps > 0;
		const functionName = useTax
			? "swapNativeToTaxToken"
			: "swapNativeToTokenViaBridge";
		const args = [
			route.bridgeToken,
			token,
			route.dexId,
			route.fee,
			account,
			minOut,
			dl,
		] as const;
		zapDebug("swap:buy", { functionName, args, value: quote.amountIn });
		const { request } = await simulateContract(wagmiConfig, {
			account,
			address: zapRouter,
			abi: ZAP_ROUTER_ABI,
			functionName,
			args: [...args],
			value: quote.amountIn,
		});
		const hash = await writeWithGas(request, gas);
		await waitForTransactionReceipt(wagmiConfig, { hash });
		return hash;
	}

	await ensureAllowance({
		token,
		owner: account,
		spender: zapRouter,
		amount: quote.amountIn,
	});

	const functionName =
		Number(route.dexType) === ZAP_DEX_TYPE.V2
			? "swapTaxTokenToNative"
			: "swapTokenToNativeViaBridge";
	const args = [
		token,
		route.bridgeToken,
		route.dexId,
		route.fee,
		account,
		quote.amountIn,
		minOut,
		dl,
	] as const;
	zapDebug("swap:sell", { functionName, args });
	const { request } = await simulateContract(wagmiConfig, {
		account,
		address: zapRouter,
		abi: ZAP_ROUTER_ABI,
		functionName,
		args: [...args],
	});
	const hash = await writeWithGas(request, gas);
	await waitForTransactionReceipt(wagmiConfig, { hash });
	return hash;
}
