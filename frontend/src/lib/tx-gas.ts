/**
 * Resolve gasPrice / gas limit from trade settings.
 */
"use client";

import { estimateGas, getGasPrice, writeContract } from "wagmi/actions";
import { parseGwei, type Address, type Hex } from "viem";
import {
	gasModeMultiplier,
	type TradeSettings,
} from "./trade-settings";
import { wagmiConfig } from "./wagmi";
import { getActiveChain } from "./chain";

export type TxGasOverrides = {
	gasPrice?: bigint;
	gas?: bigint;
};

export async function resolveGasPrice(
	settings: TradeSettings,
): Promise<bigint> {
	if (settings.gasMode === "CUSTOM") {
		const gwei = Number(settings.gasGwei);
		if (!Number.isFinite(gwei) || gwei <= 0) {
			throw new Error("Enter a valid gas price (Gwei)");
		}
		return parseGwei(String(gwei));
	}
	const market = await getGasPrice(wagmiConfig, { chainId: getActiveChain().id });
	const mult = gasModeMultiplier(settings.gasMode);
	return BigInt(Math.floor(Number(market) * mult));
}

export async function resolveGasLimit(params: {
	settings: TradeSettings;
	account: Address;
	to: Address;
	data?: Hex;
	value?: bigint;
}): Promise<bigint | undefined> {
	const custom = params.settings.maxGas.trim();
	if (custom) {
		const n = BigInt(custom.replace(/\D/g, "") || "0");
		if (n <= 0n) throw new Error("Enter a valid max gas");
		return n;
	}
	try {
		const estimated = await estimateGas(wagmiConfig, {
			account: params.account,
			to: params.to,
			data: params.data,
			value: params.value,
			chainId: getActiveChain().id,
		});
		return (estimated * 120n) / 100n;
	} catch {
		return undefined;
	}
}

export async function buildTxGas(
	settings: TradeSettings,
	estimate?: {
		account: Address;
		to: Address;
		data?: Hex;
		value?: bigint;
	},
): Promise<TxGasOverrides> {
	const gasPrice = await resolveGasPrice(settings);
	const out: TxGasOverrides = { gasPrice };
	if (estimate) {
		const gas = await resolveGasLimit({ settings, ...estimate });
		if (gas != null) out.gas = gas;
	} else if (settings.maxGas.trim()) {
		const n = BigInt(settings.maxGas.replace(/\D/g, "") || "0");
		if (n > 0n) out.gas = n;
	}
	return out;
}

/** BSC uses legacy gasPrice; merge after simulate then write */
export async function writeWithGas(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	request: Record<string, any>,
	gas?: TxGasOverrides,
) {
	const {
		type: _type,
		maxFeePerGas: _maxFee,
		maxPriorityFeePerGas: _maxPriority,
		...rest
	} = request;
	// wagmi generics are strict (eip1559 vs legacy / chain union); write legacy at runtime
	return writeContract(wagmiConfig, {
		...rest,
		type: "legacy",
		...(gas?.gasPrice != null ? { gasPrice: gas.gasPrice } : {}),
		...(gas?.gas != null ? { gas: gas.gas } : {}),
		// biome-ignore lint/suspicious/noExplicitAny: chain/tx-type union from simulate
	} as any);
}
