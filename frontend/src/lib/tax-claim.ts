/**
 * Tax dividend claim: unrelated to invite rebate — no backend-signed voucher.
 * Each tax token computes claimable (`claimableFee`); anyone can call the shared
 * FeeClaimHelper claimFee(address[] tokens) without a signature and receive funds
 * as the caller. Multiple token addresses = batch claim (multiple tokens, not
 * payouts to multiple people).
 *
 * ABI and addresses verified against real `meme-launcher` source (not reverse-guessed):
 * `src/util/abi/fee-claim-helper.abi.json` (`claimFee(address[])` returns
 * `bool[] successes`, not void; also `claimFeeFor(address account, address[] tokens)`
 * to claim for one account across tokens — unused here; our claim-for-others uses
 * each TaxToken's `claimFee(address[] accounts)`, a separate path — see
 * `claimTaxFeeForOthers`) and `src/util/claim-batch.js` (BSC mainnet + testnet).
 */
"use client";

import {
	readContracts,
	simulateContract,
	waitForTransactionReceipt,
	writeContract,
} from "wagmi/actions";
import type { Address } from "viem";
import { getActiveChain, toMemeApiNetworkCode, toMemeApiNetworkName } from "./chain";
import { memeGet } from "./meme-api";
import { wagmiConfig } from "./wagmi";

/** Hardcoded addresses from meme-launcher `src/util/claim-batch.js` `FEE_CLAIM_HELPER_BY_CHAIN` */
const FEE_CLAIM_HELPER_BY_CHAIN: Record<number, Address> = {
	56: "0x1e030d951f59bF24d8B0e5af4e90E3cbEcf9622C",
	97: "0x8F8110Bdc705972926CC2312Ee3Ce52E710731E1",
};

/** Max tokens per claim tx — too many blows gas (same cap as reference) */
export const TAX_CLAIM_BATCH_SIZE = 20;

const CLAIMABLE_FEE_ABI = [
	{
		type: "function",
		name: "claimableFee",
		stateMutability: "view",
		inputs: [{ name: "account", type: "address" }],
		outputs: [{ name: "", type: "uint256" }],
	},
] as const;

const FEE_CLAIM_HELPER_ABI = [
	{
		type: "function",
		name: "claimFee",
		stateMutability: "nonpayable",
		inputs: [{ name: "tokens", type: "address[]" }],
		outputs: [{ name: "successes", type: "bool[]" }],
	},
] as const;

/** TaxToken / Stock4TaxToken have a no-arg claim on the token itself — no FeeClaimHelper */
const CLAIM_FEE_DIRECT_ABI = [
	{
		type: "function",
		name: "claimFee",
		stateMutability: "nonpayable",
		inputs: [],
		outputs: [],
	},
] as const;

/**
 * Verified on-chain: TaxToken/Stock4TaxToken have this overload — anyone can call
 * to claim for listed accounts (funds go to each account, not the caller).
 */
const CLAIM_FEE_FOR_OTHERS_ABI = [
	{
		type: "function",
		name: "claimFee",
		stateMutability: "nonpayable",
		inputs: [{ name: "accounts", type: "address[]" }],
		outputs: [],
	},
] as const;

/** Claim for others (`token.tax` / `token.tax.stock`): caller pays gas; funds to each account */
export async function claimTaxFeeForOthers(
	tokenAddress: Address,
	accounts: Address[],
	caller: Address,
): Promise<Address> {
	const { request } = await simulateContract(wagmiConfig, {
		account: caller,
		abi: CLAIM_FEE_FOR_OTHERS_ABI,
		address: tokenAddress,
		functionName: "claimFee",
		args: [accounts],
	});
	const hash = await writeContract(wagmiConfig, request);
	await waitForTransactionReceipt(wagmiConfig, { hash });
	return hash;
}

/**
 * Tax claim (`token.tax` / `token.tax.stock`): call the token's own no-arg
 * `claimFee()` — verified on-chain for both templates; no unverified shared
 * FeeClaimHelper hop.
 */
export async function claimTaxFeeDirect(
	tokenAddress: Address,
	account: Address,
): Promise<Address> {
	const { request } = await simulateContract(wagmiConfig, {
		account,
		abi: CLAIM_FEE_DIRECT_ABI,
		address: tokenAddress,
		functionName: "claimFee",
	});
	const hash = await writeContract(wagmiConfig, request);
	await waitForTransactionReceipt(wagmiConfig, { hash });
	return hash;
}

async function findAddressIn(
	path: string,
	networkCode: string | number,
	name: string,
): Promise<Address | null> {
	try {
		const res = await memeGet<Array<{ name: string; address: string }>>(path, {
			networkCode,
		});
		if (res.code !== 0) return null;
		const entry = res.data?.find((r) => r.name === name);
		return (entry?.address as Address) || null;
	} catch {
		return null;
	}
}

/**
 * Try partner address list first (`loadContracts()` in open-four.ts), then
 * official-site Web list (`loadRebateKeeperAddress()` in rebate.ts), then
 * hardcoded; if current chain missing, throw — do not guess.
 */
export async function loadFeeClaimHelperAddress(): Promise<Address> {
	const fromPartnerApi = await findAddressIn(
		"/meme-api/api/v1/public/address",
		toMemeApiNetworkCode(),
		"FeeClaimHelper",
	);
	if (fromPartnerApi) return fromPartnerApi;

	const fromWebApi = await findAddressIn(
		"/meme-api/v1/public/address",
		toMemeApiNetworkName(),
		"FeeClaimHelper",
	);
	if (fromWebApi) return fromWebApi;

	const hardcoded = FEE_CLAIM_HELPER_BY_CHAIN[getActiveChain().id];
	if (hardcoded) return hardcoded;

	throw new Error(`FeeClaimHelper address unknown for chain ${getActiveChain().id}`);
}

/**
 * Live-read claimable per token (more accurate than `/tax/list` `amount`,
 * which has a 60s cache). Failed reads return null for that item only.
 */
export async function readClaimableFees(
	tokenAddresses: Address[],
	account: Address,
): Promise<(bigint | null)[]> {
	if (tokenAddresses.length === 0) return [];
	const results = await readContracts(wagmiConfig, {
		contracts: tokenAddresses.map((token) => ({
			address: token,
			abi: CLAIMABLE_FEE_ABI,
			functionName: "claimableFee" as const,
			args: [account] as const,
		})),
		allowFailure: true,
	});
	return results.map((r) => (r.status === "success" ? (r.result as bigint) : null));
}

export type ClaimTaxFeesResult = {
	/** Tx hashes actually sent, in processing order */
	hashes: Address[];
};

/** Claim tax dividends: no signature; >20 `tokenAddresses` auto-batches into multiple txs. */
export async function claimTaxFees(
	tokenAddresses: Address[],
	account: Address,
): Promise<ClaimTaxFeesResult> {
	if (tokenAddresses.length === 0) return { hashes: [] };

	const helper = await loadFeeClaimHelperAddress();
	const hashes: Address[] = [];

	for (let i = 0; i < tokenAddresses.length; i += TAX_CLAIM_BATCH_SIZE) {
		const batch = tokenAddresses.slice(i, i + TAX_CLAIM_BATCH_SIZE);
		const { request } = await simulateContract(wagmiConfig, {
			account,
			abi: FEE_CLAIM_HELPER_ABI,
			address: helper,
			functionName: "claimFee",
			args: [batch],
		});
		const hash = await writeContract(wagmiConfig, request);
		await waitForTransactionReceipt(wagmiConfig, { hash });
		hashes.push(hash);
	}

	return { hashes };
}
