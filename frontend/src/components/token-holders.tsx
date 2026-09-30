/**
 * Holders list (partner public/token/holder).
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
	fetchTokenHolders,
	type TokenHolder,
} from "@/lib/meme-api";
import { Skeleton } from "@/components/skeleton";
import { useI18n } from "@/i18n/provider";
import { getExplorerBase } from "@/lib/chain";
import { formatAddress, formatCompact } from "@/lib/format";

function holderPct(amount: string | number, total?: string | number | null) {
	const a = Number(amount);
	const t = Number(total);
	if (!Number.isFinite(a) || !Number.isFinite(t) || t <= 0) return null;
	return (a / t) * 100;
}

function HolderRow({
	item,
	label,
	totalAmount,
	explorerBase,
}: {
	item: TokenHolder;
	label?: string;
	totalAmount?: string | number | null;
	explorerBase: string;
}) {
	const pct = holderPct(item.amount, totalAmount);

	return (
		<a
			className="holder-row"
			href={`${explorerBase}/address/${item.address}`}
			target="_blank"
			rel="noreferrer"
		>
			<div className="holder-main">
				<span className="holder-addr">{formatAddress(item.address, 4)}</span>
				{label ? <em className="holder-tag">{label}</em> : null}
			</div>
			<span className="holder-amt">{formatCompact(item.amount, 4)}</span>
			<span className="holder-pct">
				{pct == null ? "—" : `${pct.toFixed(pct >= 1 ? 2 : 4)}%`}
			</span>
		</a>
	);
}

export function TokenHolders({
	tokenId,
	totalAmount,
	creator,
	tokenAddress,
}: {
	tokenId: number;
	totalAmount?: string | number | null;
	creator?: string | null;
	tokenAddress?: string | null;
}) {
	const { t } = useI18n();
	const [data, setData] = useState<{
		lp?: TokenHolder | null;
		reserve?: TokenHolder | null;
		clickFun?: TokenHolder | null;
		tokenHolders: TokenHolder[];
	} | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		(async () => {
			try {
				const res = await fetchTokenHolders(tokenId);
				if (cancelled) return;
				if (res.code !== 0) throw new Error("load_failed");
				setData({
					lp: res.data?.lp,
					reserve: res.data?.reserve,
					clickFun: res.data?.clickFun,
					tokenHolders: res.data?.tokenHolders || [],
				});
			} catch {
				if (!cancelled) {
					setError(t("error.load"));
					setData(null);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [tokenId, t]);

	const rows = useMemo(() => {
		if (!data) return [];
		const out: { item: TokenHolder; label?: string }[] = [];
		if (data.reserve?.address) {
			out.push({ item: data.reserve, label: t("holders.reserve") });
		}
		if (data.lp?.address) {
			out.push({ item: data.lp, label: "LP" });
		}
		if (data.clickFun?.address) {
			out.push({ item: data.clickFun, label: "Click.fun" });
		}
		for (const h of data.tokenHolders) {
			if (!h?.address) continue;
			const addr = h.address.toLowerCase();
			let label: string | undefined;
			if (creator && addr === creator.toLowerCase()) {
				label = t("holders.creator");
			}
			else if (tokenAddress && addr === tokenAddress.toLowerCase())
				label = t("holders.bonding");
			out.push({ item: h, label });
		}
		return out;
	}, [data, creator, tokenAddress, t]);

	if (loading) {
		return (
			<div className="holders">
				{Array.from({ length: 8 }).map((_, i) => (
					<div className="holder-row" key={i}>
						<span className="holder-main">
							<Skeleton width="70%" height="0.75rem" />
						</span>
						<Skeleton width="60%" height="0.75rem" />
						<Skeleton width="50%" height="0.75rem" />
					</div>
				))}
			</div>
		);
	}
	if (error) return <p className="err">{error}</p>;
	if (!rows.length) return <p className="muted">{t("holders.empty")}</p>;

	return (
		<div className="holders">
			<div className="holders-head">
				<span>{t("holders.wallet")}</span>
				<span>{t("holders.amount")}</span>
				<span>{t("holders.share")}</span>
			</div>
			{rows.map(({ item, label }) => (
				<HolderRow
					key={`${label || "h"}-${item.address}`}
					item={item}
					label={label}
					totalAmount={totalAmount}
					explorerBase={getExplorerBase()}
				/>
			))}
		</div>
	);
}
