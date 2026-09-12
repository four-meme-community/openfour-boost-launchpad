/**
 * PancakeSwap V2 external trade (lightweight post-graduation path).
 * Aligned with meme-launcher default router; no heavy smart-router dependency.
 */
"use client";

import {
	readContract,
	simulateContract,
	waitForTransactionReceipt,
	writeContract,
} from "wagmi/actions";
import { erc20Abi, type Address, type Hex } from "viem";
import { publicEnv } from "./env";
import { wagmiConfig } from "./wagmi";
import { writeWithGas, type TxGasOverrides } from "./tx-gas";

export const PANCAKE_V2_ROUTER = (
	publicEnv.isProd
		? "0x10ED43C718714eb63d5aA57B78B54704E256024E"
		: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"
) as Address;

export const WBNB = (
	publicEnv.isProd
		? "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
		: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"
) as Address;

const ZERO = "0x0000000000000000000000000000000000000000";

const routerAbi = [
	{
		type: "function",
		name: "getAmountsOut",
		stateMutability: "view",
		inputs: [
			{ name: "amountIn", type: "uint256" },
			{ name: "path", type: "address[]" },
		],
		outputs: [{ name: "amounts", type: "uint256[]" }],
	},
	{
		type: "function",
		name: "swapExactETHForTokensSupportingFeeOnTransferTokens",
		stateMutability: "payable",
		inputs: [
			{ name: "amountOutMin", type: "uint256" },
			{ name: "path", type: "address[]" },
			{ name: "to", type: "address" },
			{ name: "deadline", type: "uint256" },
		],
		outputs: [],
	},
	{
		type: "function",
		name: "swapExactTokensForETHSupportingFeeOnTransferTokens",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "amountIn", type: "uint256" },
			{ name: "amountOutMin", type: "uint256" },
			{ name: "path", type: "address[]" },
			{ name: "to", type: "address" },
			{ name: "deadline", type: "uint256" },
		],
		outputs: [],
	},
	{
		type: "function",
		name: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "amountIn", type: "uint256" },
			{ name: "amountOutMin", type: "uint256" },
			{ name: "path", type: "address[]" },
			{ name: "to", type: "address" },
			{ name: "deadline", type: "uint256" },
		],
		outputs: [],
	},
] as const;

function isNativeLike(addr?: string | null) {
	if (!addr) return true;
	const a = addr.toLowerCase();
	return a === ZERO || a === WBNB.toLowerCase();
}

function deadline() {
	return BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
}

async function tryAmountsOut(amountIn: bigint, path: Address[]) {
	try {
		const amounts = (await readContract(wagmiConfig, {
			address: PANCAKE_V2_ROUTER,
			abi: routerAbi,
			functionName: "getAmountsOut",
			args: [amountIn, path],
		})) as bigint[];
		return amounts[amounts.length - 1] ?? 0n;
	} catch {
		return null;
	}
}

/** Build buy path: payment side → meme token */
export async function resolveBuyPath(params: {
	token: Address;
	quoteAsset?: Address | null;
	useNative: boolean;
}): Promise<Address[] | null> {
	const { token, quoteAsset, useNative } = params;
	if (useNative || isNativeLike(quoteAsset)) {
		return [WBNB, token];
	}
	const quote = quoteAsset as Address;
	const direct = await tryAmountsOut(10n ** 15n, [quote, token]);
	if (direct != null) return [quote, token];
	const via = await tryAmountsOut(10n ** 15n, [quote, WBNB, token]);
	if (via != null) return [quote, WBNB, token];
	return null;
}

/** Build sell path: meme token → receive side */
export async function resolveSellPath(params: {
	token: Address;
	quoteAsset?: Address | null;
	useNative: boolean;
}): Promise<Address[] | null> {
	const { token, quoteAsset, useNative } = params;
	if (useNative || isNativeLike(quoteAsset)) {
		return [token, WBNB];
	}
	const quote = quoteAsset as Address;
	const direct = await tryAmountsOut(10n ** 15n, [token, quote]);
	if (direct != null) return [token, quote];
	const via = await tryAmountsOut(10n ** 15n, [token, WBNB, quote]);
	if (via != null) return [token, WBNB, quote];
	return null;
}

export async function quoteExactIn(amountIn: bigint, path: Address[]) {
	if (amountIn <= 0n || path.length < 2) return 0n;
	const out = await tryAmountsOut(amountIn, path);
	return out ?? 0n;
}

async function ensureAllowance(params: {
	token: Address;
	owner: Address;
	spender: Address;
	amount: bigint;
}) {
	const allowance = await readContract(wagmiConfig, {
		address: params.token,
		abi: erc20Abi,
		functionName: "allowance",
		args: [params.owner, params.spender],
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

export async function swapExactIn(params: {
	account: Address;
	amountIn: bigint;
	amountOutMin: bigint;
	path: Address[];
	/** Whether path[0] is native BNB (msg.value) */
	payNative: boolean;
	gasPrice?: bigint;
	gas?: bigint;
}) {
	const { account, amountIn, amountOutMin, path, payNative } = params;
	const dl = deadline();
	const gas: TxGasOverrides = {
		gasPrice: params.gasPrice,
		gas: params.gas,
	};

	if (payNative) {
		const { request } = await simulateContract(wagmiConfig, {
			account,
			abi: routerAbi,
			address: PANCAKE_V2_ROUTER,
			functionName: "swapExactETHForTokensSupportingFeeOnTransferTokens",
			args: [amountOutMin, path, account, dl],
			value: amountIn,
		});
		const hash = await writeWithGas(request, gas);
		await waitForTransactionReceipt(wagmiConfig, { hash });
		return hash;
	}

	await ensureAllowance({
		token: path[0],
		owner: account,
		spender: PANCAKE_V2_ROUTER,
		amount: amountIn,
	});

	const receiveNative = path[path.length - 1].toLowerCase() === WBNB.toLowerCase();
	if (receiveNative) {
		const { request } = await simulateContract(wagmiConfig, {
			account,
			abi: routerAbi,
			address: PANCAKE_V2_ROUTER,
			functionName: "swapExactTokensForETHSupportingFeeOnTransferTokens",
			args: [amountIn, amountOutMin, path, account, dl],
		});
		const hash = await writeWithGas(request, gas);
		await waitForTransactionReceipt(wagmiConfig, { hash });
		return hash;
	}

	const { request } = await simulateContract(wagmiConfig, {
		account,
		abi: routerAbi,
		address: PANCAKE_V2_ROUTER,
		functionName: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
		args: [amountIn, amountOutMin, path, account, dl],
	});
	const hash = await writeWithGas(request, gas);
	await waitForTransactionReceipt(wagmiConfig, { hash });
	return hash;
}

export type { Hex };
