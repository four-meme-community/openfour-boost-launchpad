/**
 * Referral rebate card: total referrals + per-token claimable (paged) + claim button.
 * Mirrors meme-launcher `referral-info.jsx` three sections in one card.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/provider";
import { imageUrl } from "@/lib/meme-api";
import { formatNum } from "@/lib/format";
import { loadCommonConfig, type CommonConfigItem } from "@/lib/open-four";
import type { InviteUserInfo, RebateTokenBalance } from "@/lib/invite-api";

const PAGE_SIZE = 8;

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		out.push(items.slice(i, i + size));
	}
	return out;
}

function TokenIcon({
	symbol,
	logoUrl,
}: {
	symbol: string;
	logoUrl?: string;
}) {
	if (logoUrl) {
		return (
			// eslint-disable-next-line @next/next/no-img-element
			<img src={imageUrl(logoUrl)} alt="" className="referral-token-icon" />
		);
	}
	return (
		<span
			className="referral-token-icon referral-token-icon--fallback"
			aria-hidden
		>
			{symbol.slice(0, 1).toUpperCase()}
		</span>
	);
}

export function ReferralRebateCard({
	info,
	busy,
	onClaim,
}: {
	info: InviteUserInfo | null;
	busy: boolean;
	onClaim: () => void;
}) {
	const { t } = useI18n();
	const [page, setPage] = useState(0);
	const [logoBySymbol, setLogoBySymbol] = useState<Map<string, string>>(
		new Map(),
	);

	useEffect(() => {
		let cancelled = false;
		loadCommonConfig()
			.then((items: CommonConfigItem[]) => {
				if (cancelled) return;
				setLogoBySymbol(
					new Map(
						items
							.filter((item) => item.symbol && item.logoUrl)
							.map((item) => [item.symbol.toLowerCase(), item.logoUrl as string]),
					),
				);
			})
			.catch(() => {
				// Icons are nice-to-have; fall back if missing
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const tokens: RebateTokenBalance[] = info?.rebateRets ?? [];
	const pages = useMemo(() => chunk(tokens, PAGE_SIZE), [tokens]);
	const currentPage = pages[Math.min(page, Math.max(pages.length - 1, 0))] ?? [];

	return (
		<div className="card referral-rebate-card">
			<div className="referral-stat-row">
				<span className="referral-stat-label">
					{t("referral.totalReferrals")}
				</span>
				<strong className="referral-stat-value">
					{info?.inviteCount ?? 0}
				</strong>
			</div>

			<div className="referral-earned-head">
				<span>{t("referral.totalEarned")}</span>
				<span className="muted">
					{t("referral.tokensCount", { count: tokens.length })}
				</span>
			</div>

			{tokens.length === 0 ? (
				<p className="referral-empty-reward">{t("referral.emptyReward")}</p>
			) : (
				<>
					<div className="referral-token-grid">
						{currentPage.map((item, i) => (
							<div className="referral-token-card" key={`${item.symbol}-${i}`}>
								<TokenIcon
									symbol={item.symbol}
									logoUrl={logoBySymbol.get((item.symbol || "").toLowerCase())}
								/>
								<div className="referral-token-meta">
									<span>{item.symbol || "BNB"}</span>
									<strong>{formatNum(item.bnbAmount, 4)}</strong>
								</div>
							</div>
						))}
					</div>

					{pages.length > 1 ? (
						<div className="referral-dots">
							{pages.map((_, i) => (
								<button
									key={i}
									type="button"
									className={`referral-dot${i === page ? " active" : ""}`}
									aria-label={`${i + 1}`}
									onClick={() => setPage(i)}
								/>
							))}
						</div>
					) : null}
				</>
			)}

			<button
				type="button"
				className="btn referral-claim-btn"
				disabled={busy}
				onClick={onClaim}
			>
				{busy ? "…" : t("referral.claim")}
			</button>
		</div>
	);
}
