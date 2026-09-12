/**
 * Cross-token tax dividends list + batch claim logic, extracted from
 * `app/dividends/page.tsx` so `/token/[address]/tax` can embed the same data/UX
 * in a side panel without another navigation.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { DividendRow } from "@/components/dividend-row";
import { useAuth } from "@/hooks/auth-provider";
import { useI18n } from "@/i18n/provider";
import { fetchTaxTokenList, type TaxTokenItem } from "@/lib/tax-api";
import { claimTaxFees, readClaimableFees } from "@/lib/tax-claim";

function hasPositiveClaimable(item: TaxTokenItem, live: bigint | null | undefined) {
	if (live != null) return live > 0n;
	return Number(item.amount) > 0;
}

export function DividendsPanel({
	/** Side embed: denser layout; hide "Your balance" to free space for claimable */
	compact = false,
}: {
	compact?: boolean;
}) {
	const { t } = useI18n();
	const { isAuthenticated } = useAuth();
	const { address: account } = useAccount();

	const [items, setItems] = useState<TaxTokenItem[]>([]);
	const [claimableByToken, setClaimableByToken] = useState<
		Map<string, bigint | null>
	>(new Map());
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const reload = useCallback(async () => {
		if (!isAuthenticated) {
			setItems([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const res = await fetchTaxTokenList();
			const list = res.code === 0 ? res.data || [] : [];
			setItems(list);

			const addrs = list
				.map((i) => i.tokenAddress)
				.filter((a): a is string => isAddress(a));
			if (account && addrs.length) {
				const values = await readClaimableFees(addrs as Address[], account);
				setClaimableByToken(
					new Map(addrs.map((a, idx) => [a, values[idx] ?? null])),
				);
			} else {
				setClaimableByToken(new Map());
			}
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated, account]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const claimableTokens = useMemo(
		() =>
			items.filter((i) =>
				hasPositiveClaimable(i, claimableByToken.get(i.tokenAddress)),
			),
		[items, claimableByToken],
	);

	const toggle = (tokenAddress: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(tokenAddress)) next.delete(tokenAddress);
			else next.add(tokenAddress);
			return next;
		});
	};

	const allSelected =
		claimableTokens.length > 0 && selected.size === claimableTokens.length;

	const toggleAll = () => {
		setSelected(
			allSelected
				? new Set()
				: new Set(claimableTokens.map((i) => i.tokenAddress)),
		);
	};

	const onClaimSelected = async () => {
		if (!account || selected.size === 0) return;
		setMessage(null);
		setBusy(true);
		try {
			const addrs = [...selected] as Address[];
			await claimTaxFees(addrs, account);
			setMessage({
				type: "success",
				text: t("dividends.claimed", { count: addrs.length }),
			});
			setSelected(new Set());
			await reload();
		} catch {
			setMessage({ type: "error", text: t("dividends.claimFailed") });
		} finally {
			setBusy(false);
		}
	};

	/** Side embed reuses `.tax-card` look (border/radius/title) to match other tax
	 *  detail cards; standalone /dividends keeps `.dividends-card` */
	const cardClass = compact ? "card tax-card" : "card dividends-card";
	const heading = compact ? (
		<>
			<h2>{t("dividends.title")}</h2>
			<p className="muted dividends-panel-desc">{t("dividends.description")}</p>
		</>
	) : null;

	if (!isAuthenticated) {
		return (
			<div className={cardClass}>
				{heading}
				<p className="muted dividends-empty">{t("dividends.signIn")}</p>
			</div>
		);
	}
	if (loading) {
		return (
			<div className={cardClass}>
				{heading}
				<p className="muted dividends-empty">{t("common.loading")}</p>
			</div>
		);
	}
	if (claimableTokens.length === 0) {
		return (
			<div className={cardClass}>
				{heading}
				<p className="muted dividends-empty">{t("dividends.empty")}</p>
			</div>
		);
	}

	return (
		<div className={cardClass}>
			{heading}
			{compact ? (
				<p className="muted dividends-summary">
					{t("dividends.summary", { count: claimableTokens.length })}
				</p>
			) : (
				<div className="dividends-stat-row">
					<span className="dividends-stat-label">{t("dividends.claimableTokens")}</span>
					<strong className="dividends-stat-value">{claimableTokens.length}</strong>
				</div>
			)}

			<div className={`dividends-head${compact ? " dividends-head--compact" : ""}`}>
				<input
					type="checkbox"
					className="dividend-row-check"
					checked={allSelected}
					onChange={toggleAll}
					aria-label={t("dividends.selectAll")}
				/>
				<span>{t("dividends.token")}</span>
				{compact ? null : <span className="dividend-row-num">{t("dividends.balance")}</span>}
				<span className="dividend-row-num">{t("dividends.claimable")}</span>
			</div>

			<div className="dividends-body">
				{claimableTokens.map((item) => (
					<DividendRow
						key={item.tokenAddress}
						item={item}
						claimable={claimableByToken.get(item.tokenAddress) ?? null}
						selected={selected.has(item.tokenAddress)}
						onToggle={() => toggle(item.tokenAddress)}
						compact={compact}
					/>
				))}
			</div>

			<button
				type="button"
				className="btn dividends-claim-btn"
				disabled={busy || selected.size === 0}
				onClick={onClaimSelected}
			>
				{busy ? "…" : t("dividends.claimSelected")}
			</button>

			{message ? (
				<p className={message.type === "error" ? "err" : "ok"}>{message.text}</p>
			) : null}
		</div>
	);
}
