/**
 * Invite / rebate (official Web API, same as meme-launcher).
 * Use this channel when partner public docs lack the capability.
 */
"use client";

import { memeGet, memePost } from "./meme-api";

/** Per-token accrued rebate balance (one card in the Total Income section) */
export type RebateTokenBalance = {
	symbol: string;
	bnbAmount: string | number;
	[k: string]: unknown;
};

export type InviteUserInfo = {
	referralCode?: string;
	inviteRate?: number;
	/** Total referrals */
	inviteCount?: number;
	/** Total income: claimable balances aggregated by token */
	rebateRets?: RebateTokenBalance[];
	invitedAddress?: string;
	invitedAUserName?: string;
	invitedAvatar?: string;
	invitedUserId?: number;
	/** Pending / accrued fields follow upstream */
	[k: string]: unknown;
};

/** One invite record (a row in the Invite Friends list) */
export type InviteRecord = {
	userId: number;
	userName?: string;
	address?: string;
	avatarPath?: string;
	symbol?: string;
	bnbAmount?: string | number;
	inviteDate?: number;
	[k: string]: unknown;
};

/** Claim if any token balance > 0 (same as meme-launcher check() — skip useless approve) */
export function hasClaimableRebate(rebateRets?: RebateTokenBalance[]): boolean {
	return (rebateRets ?? []).some((item) => Number(item.bnbAmount) > 0);
}

/**
 * `/invite/approve` only returns a signed claim voucher — not final settlement.
 * Transfer happens via on-chain RebateKeeper.claim(); see lib/rebate.ts.
 */
export type RebateApproval = {
	id: string | number;
	time: string | number;
	sign: string;
	feeInfos: { tokenAddress: string; amount: string | number }[];
	[k: string]: unknown;
};

export async function fetchInviteUser() {
	return memeGet<InviteUserInfo>("/meme-api/v1/private/invite/user");
}

export async function bindInviteCode(inviteCode: string) {
	return memePost<unknown>("/meme-api/v1/private/invite", { inviteCode });
}

/** Invite friends: paginated invitees + their rebate records */
export async function fetchInviteRecords(pageIndex: number, pageSize = 10) {
	return memeGet<InviteRecord[]>("/meme-api/v1/private/invite/user/list", {
		pageIndex,
		pageSize,
	});
}

/** Rebate claim voucher (step 1; claimRebate in lib/rebate.ts does on-chain step 2) */
export async function approveRebateClaim() {
	return memePost<RebateApproval>("/meme-api/v1/private/invite/approve");
}
