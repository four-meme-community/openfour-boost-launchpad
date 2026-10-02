/**
 * Invite friends: paginated invitees + rebate records.
 * Compared to meme-launcher `referral-record.jsx` (infinite scroll there),
 * we use a simpler "Load more" button — same outcome, no extra deps.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useCommonConfig } from "@/hooks/use-common-config";
import { useI18n } from "@/i18n/provider";
import { formatAddress, formatNum } from "@/lib/format";
import { fetchInviteRecords, type InviteRecord } from "@/lib/invite-api";

const PAGE_SIZE = 10;
/** Upstream sentinel userId === -1 means LP reward, not an invitee */
const LP_REWARDS_USER_ID = -1;

function formatRecordDate(value?: number): string {
	if (!value) return "—";
	const ms = value > 1e12 ? value : value * 1000;
	const date = new Date(ms);
	if (Number.isNaN(date.getTime())) return "—";
	return date.toLocaleDateString();
}

export function ReferralRecords({ enabled }: { enabled: boolean }) {
	const { t } = useI18n();
	const { displayOf } = useCommonConfig();
	const [records, setRecords] = useState<InviteRecord[]>([]);
	const [pageIndex, setPageIndex] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [loading, setLoading] = useState(false);
	const [loaded, setLoaded] = useState(false);

	const loadPage = useCallback(async (page: number) => {
		setLoading(true);
		try {
			const res = await fetchInviteRecords(page, PAGE_SIZE);
			const items = res.code === 0 ? res.data || [] : [];
			setRecords((prev) => (page === 1 ? items : [...prev, ...items]));
			setHasMore(items.length >= PAGE_SIZE);
			setPageIndex(page);
		} catch {
			setHasMore(false);
		} finally {
			setLoading(false);
			setLoaded(true);
		}
	}, []);

	useEffect(() => {
		if (!enabled) {
			setRecords([]);
			setPageIndex(1);
			setHasMore(true);
			setLoaded(false);
			return;
		}
		void loadPage(1);
	}, [enabled, loadPage]);

	if (!enabled) return null;

	return (
		<div className="card referral-records-card">
			<h2 className="referral-records-title">{t("referral.invited")}</h2>

			{records.length === 0 ? (
				<div className="referral-empty">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden>
						<path
							d="M6 2h9l3 3v17H6z"
							stroke="currentColor"
							strokeWidth="1.4"
							strokeLinejoin="round"
						/>
						<path
							d="M9 12h6M9 16h6"
							stroke="currentColor"
							strokeWidth="1.4"
							strokeLinecap="round"
						/>
					</svg>
					<span>{loaded ? t("referral.recordsEmpty") : "…"}</span>
				</div>
			) : (
				<>
					<div className="referral-records-head">
						<span>{t("referral.recordUser")}</span>
						<span>{t("referral.recordEarned")}</span>
						<span>{t("referral.recordDate")}</span>
					</div>
					<div className="referral-records-body">
						{records.map((item, i) => (
							<div
								className="referral-record-row"
								key={`${item.userId}-${item.inviteDate}-${i}`}
							>
								<span className="referral-record-user">
									{item.userId === LP_REWARDS_USER_ID
										? t("referral.lpRewards")
										: item.userName || formatAddress(item.address)}
								</span>
								<span>
									{formatNum(item.bnbAmount, 4)}{" "}
									{displayOf(item.symbol) || item.symbol || "BNB"}
								</span>
								<span className="muted">{formatRecordDate(item.inviteDate)}</span>
							</div>
						))}
					</div>
					{hasMore ? (
						<button
							type="button"
							className="btn btn-ghost referral-load-more"
							disabled={loading}
							onClick={() => loadPage(pageIndex + 1)}
						>
							{loading ? "…" : t("referral.loadMore")}
						</button>
					) : null}
				</>
			)}
		</div>
	);
}
