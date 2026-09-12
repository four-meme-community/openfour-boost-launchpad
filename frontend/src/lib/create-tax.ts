/**
 * Tax-template create: defaults, detection, validation (aligned with meme-launcher Stock4 / custom tax).
 */
import { isAddress, zeroHash } from "viem";
import type { ParamDesc } from "./open-four-encode";

export const DEFAULT_TAX_VAULT = {
	typeId: zeroHash,
	initParamsHex: "0x" as const,
};

export type CreateTaxAllocation = {
	/** Recipient wallet share % */
	fundsRecipient: number;
	burn: number;
	divideToHolders: number;
	addToLiquidity: number;
};

export type CreateTaxInfo = {
	/** UI percent 1–10; on-chain buyFeeRate = ×100 */
	taxFeeRateBuy: number;
	taxFeeRateSell: number;
	taxMinSharing: number;
	taxWalletAddress: string;
	taxTokenInfo: CreateTaxAllocation;
};

/** Stock4 / generic custom-tax defaults: 100% to recipient wallet, 1% fee */
export const DEFAULT_CREATE_TAX_INFO: CreateTaxInfo = {
	taxFeeRateBuy: 1,
	taxFeeRateSell: 1,
	taxMinSharing: 10000,
	taxWalletAddress: "",
	taxTokenInfo: {
		fundsRecipient: 100,
		burn: 0,
		divideToHolders: 0,
		addToLiquidity: 0,
	},
};

export function isTaxTokenSchema(params: ParamDesc[]): boolean {
	return params.some(
		(p) => p.name === "taxVaultTypeId" || p.name === "buyFeeRate",
	);
}

export function allocationTotal(info: CreateTaxAllocation): number {
	return (
		Number(info.fundsRecipient || 0) +
		Number(info.burn || 0) +
		Number(info.divideToHolders || 0) +
		Number(info.addToLiquidity || 0)
	);
}

export function validateCreateTaxInfo(info: CreateTaxInfo): string | null {
	const buy = Number(info.taxFeeRateBuy);
	const sell = Number(info.taxFeeRateSell);
	if (!Number.isFinite(buy) || buy < 1 || buy > 10) {
		return "Buy tax must be between 1% and 10%";
	}
	if (!Number.isFinite(sell) || sell < 1 || sell > 10) {
		return "Sell tax must be between 1% and 10%";
	}

	const total = allocationTotal(info.taxTokenInfo);
	if (total !== 100) {
		return `Tax allocation must sum to 100% (currently ${total}%)`;
	}

	if (Number(info.taxTokenInfo.fundsRecipient) > 0) {
		const addr = info.taxWalletAddress.trim();
		if (!addr || !isAddress(addr)) {
			return "Enter a valid tax recipient address";
		}
	}

	if (Number(info.taxTokenInfo.divideToHolders) > 0) {
		const min = Number(info.taxMinSharing);
		if (!Number.isFinite(min) || min < 10000) {
			return "Holder dividend min balance must be ≥ 10000";
		}
	}

	return null;
}

/** Write tokenParams form fields (on-chain units) */
export function taxInfoToFormFields(
	info: CreateTaxInfo,
	fallbackFounder: string,
): Record<string, unknown> {
	const founder =
		Number(info.taxTokenInfo.fundsRecipient) > 0
			? info.taxWalletAddress.trim() || fallbackFounder
			: fallbackFounder;

	return {
		buyFeeRate: Math.round(Number(info.taxFeeRateBuy) * 100),
		sellFeeRate: Math.round(Number(info.taxFeeRateSell) * 100),
		rateBurn: Number(info.taxTokenInfo.burn) || 0,
		rateFounder: Number(info.taxTokenInfo.fundsRecipient) || 0,
		rateHolder: Number(info.taxTokenInfo.divideToHolders) || 0,
		rateLiquidity: Number(info.taxTokenInfo.addToLiquidity) || 0,
		minShare: Number(info.taxMinSharing) || 10000,
		founder,
		taxVaultTypeId: DEFAULT_TAX_VAULT.typeId,
		taxVaultInitParams: DEFAULT_TAX_VAULT.initParamsHex,
	};
}
