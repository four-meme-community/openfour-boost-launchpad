/**
 * Tax tokens: config query (partner public API) + holdings/dividend history (official Web API).
 *
 * Claiming is not here — tax dividends are signature-free on-chain calls (unlike
 * invite rebate's backend-signed voucher + RebateKeeper). See lib/tax-claim.ts.
 */
import { memeGet } from "./meme-api";
import { toMemeApiNetworkCode } from "./chain";

/** `GET /meme-api/api/v1/public/token/token_tax` response (tax allocation config) */
export type TokenTaxConfig = {
	feeRate?: number;
	feeRateSell?: number;
	/** Share to recipient wallet (%) */
	recipientRate?: number;
	/** Burn share (%) */
	burnRate?: number;
	/** Share to holders (%) */
	divideRate?: number;
	/** Share added to liquidity pool (%) */
	liquidityRate?: number;
	recipientAddress?: string;
	/** Min balance to receive dividends (raw smallest units) */
	minSharing?: string | number;
	/** Last distribution time */
	lastFeeDispatchTime?: string;
	/** Cumulative burned amount */
	feeBurn?: string | number;
	[k: string]: unknown;
};

export async function fetchTaxConfig(params: {
	tokenId?: number;
	address?: string;
}) {
	return memeGet<TokenTaxConfig>("/meme-api/api/v1/public/token/token_tax", {
		tokenId: params.tokenId,
		address: params.address,
		networkCode: toMemeApiNetworkCode(),
	});
}

/** One item from the user's claimable-tax token list */
export type TaxTokenItem = {
	symbol: string;
	symbolAddress: string;
	tokenAddress: string;
	tokenName: string;
	tokenImg: string;
	version?: number;
	templateId?: number;
	/** Backend hint for claimable amount (60s cache; live on-chain read is better — see lib/tax-claim.ts) */
	amount: string | number;
	[k: string]: unknown;
};

export async function fetchTaxTokenList() {
	return memeGet<TaxTokenItem[]>("/meme-api/v1/private/user/token/tax/list");
}
