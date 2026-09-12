/**
 * One /dividends row: icon+name (link to tax detail), your balance (live),
 * claimable (batch live-read from parent; fall back to API amount), checkbox.
 */
"use client";

import Link from "next/link";
import { isAddress, type Address } from "viem";
import { formatBalanceWei, useErc20Balance } from "@/hooks/use-token-balance";
import { formatNum } from "@/lib/format";
import { imageUrl } from "@/lib/meme-api";
import type { TaxTokenItem } from "@/lib/tax-api";
import { useI18n } from "@/i18n/provider";
import { useAccount } from "wagmi";

export function DividendRow({
	item,
	claimable,
	selected,
	onToggle,
	compact = false,
}: {
	item: TaxTokenItem;
	/** Live on-chain claimable; null means read failed — fall back to API amount */
	claimable: bigint | null;
	selected: boolean;
	onToggle: () => void;
	/** Side embed: hide "Your balance" column */
	compact?: boolean;
}) {
	const { href } = useI18n();
	const { address: account } = useAccount();
	const tokenAddress = isAddress(item.tokenAddress)
		? (item.tokenAddress as Address)
		: null;
	const balanceQuery = useErc20Balance(account, tokenAddress);

	const claimableDisplay =
		claimable != null
			? formatBalanceWei(claimable, balanceQuery.data?.decimals ?? 18)
			: formatNum(item.amount, 4);

	return (
		<div className={`dividend-row${compact ? " dividend-row--compact" : ""}`}>
			<input
				type="checkbox"
				className="dividend-row-check"
				checked={selected}
				onChange={onToggle}
			/>
			<Link
				href={href(`/token/${item.tokenAddress}/tax`)}
				className="dividend-row-token"
			>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src={imageUrl(item.tokenImg)} alt="" className="token-img" />
				<span>{item.tokenName}</span>
			</Link>
			{compact ? null : (
				<span className="dividend-row-num">
					{account
						? formatBalanceWei(balanceQuery.data?.value, balanceQuery.data?.decimals)
						: "—"}
				</span>
			)}
			<span className="dividend-row-num chg up">{claimableDisplay}</span>
		</div>
	);
}
