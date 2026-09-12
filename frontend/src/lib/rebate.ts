/**
 * Trade rebate claim: two-step flow (same as meme-launcher referral-info.jsx).
 *
 * 1) BFF `/invite/approve` returns a signed claim voucher only (not settlement).
 * 2) Call RebateKeeper.claim() on-chain with that voucher; user pays gas.
 */
"use client";

import {
	simulateContract,
	waitForTransactionReceipt,
	writeContract,
} from "wagmi/actions";
import type { Address } from "viem";
import rebateKeeperAbi from "@/abi/rebate-keeper.json";
import {
	approveRebateClaim,
	hasClaimableRebate,
	type RebateTokenBalance,
} from "./invite-api";
import { memeGet } from "./meme-api";
import { toMemeApiNetworkName } from "./chain";
import { wagmiConfig } from "./wagmi";

/**
 * Live address-list check showed the entry name is SCREAMING_SNAKE
 * `REBATE_KEEPER`, not camelCase `RebateKeeper` — guessing by naming habit
 * would miss it forever and never reach the on-chain call. Both
 * `/meme-api/api/v1/public/address` and `/meme-api/v1/public/address` return the
 * same data; reuse the partner endpoint already used in open-four.ts.
 */
export async function loadRebateKeeperAddress(): Promise<Address> {
	const res = await memeGet<Array<{ name: string; address: string }>>(
		"/meme-api/api/v1/public/address",
		{ networkCode: toMemeApiNetworkName() },
	);
	if (res.code !== 0) throw new Error(res.msg || "Failed to load addresses");
	const entry = res.data?.find((r) => r.name === "REBATE_KEEPER");
	if (!entry?.address) throw new Error("Missing contract REBATE_KEEPER");
	return entry.address as Address;
}

export type ClaimRebateResult =
	| { claimed: false }
	| { claimed: true; hash: Address };

/** Upstream uses this code for "this withdrawal failed" (same as meme-launcher) */
const WITHDRAWAL_FAILED_CODE = 8020;

/**
 * Claim trade rebate: returns `{claimed:false}` with no tx when nothing to claim.
 * When `rebateRets` is passed, locally check if anything is worth claiming to skip
 * a useless approve; otherwise call approve and let the backend decide.
 */
export async function claimRebate(
	account: Address,
	rebateRets?: RebateTokenBalance[],
): Promise<ClaimRebateResult> {
	if (rebateRets && !hasClaimableRebate(rebateRets)) {
		return { claimed: false };
	}

	const approveRes = await approveRebateClaim();
	if (approveRes.code === WITHDRAWAL_FAILED_CODE) {
		throw new Error("withdrawal_failed");
	}
	if (approveRes.code !== 0) {
		throw new Error(approveRes.msg || "Failed to approve claim");
	}
	const approval = approveRes.data;
	const feeInfos = approval?.feeInfos ?? [];
	if (!approval || feeInfos.length === 0) {
		return { claimed: false };
	}

	const rebateKeeper = await loadRebateKeeperAddress();
	const tokens = feeInfos.map((f) => f.tokenAddress as Address);
	const amounts = feeInfos.map((f) => BigInt(f.amount));

	const { request } = await simulateContract(wagmiConfig, {
		account,
		abi: rebateKeeperAbi,
		address: rebateKeeper,
		functionName: "claim",
		args: [BigInt(approval.id), tokens, amounts, BigInt(approval.time), approval.sign],
	});

	const hash = await writeContract(wagmiConfig, request);
	await waitForTransactionReceipt(wagmiConfig, { hash });
	return { claimed: true, hash };
}
