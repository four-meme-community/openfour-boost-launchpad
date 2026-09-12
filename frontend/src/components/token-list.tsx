/**
 * Home market table: four.meme advanced density.
 * Tabs: new / almost graduated / graduated (partner public search).
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PriceText } from "@/components/price-text";
import { Skeleton } from "@/components/skeleton";
import {
	fetchTokenList,
	imageUrl,
	isTokenOnDex,
	type MarketTab,
	type TokenListItem,
} from "@/lib/meme-api";
import {
	formatAge,
	formatCompact,
	formatPct,
} from "@/lib/format";
import { useI18n } from "@/i18n/provider";

const TABS: MarketTab[] = ["new", "soon", "graduated"];

type Period = "5m" | "1h" | "1d";

const PERIODS: { id: Period; label: string }[] = [
	{ id: "5m", label: "5m" },
	{ id: "1h", label: "1h" },
	{ id: "1d", label: "1d" },
];

function changeForPeriod(item: TokenListItem, period: Period) {
	if (period === "5m") return item.min5Increase ?? item.minIncrease;
	if (period === "1h") return item.hourIncrease;
	return item.day1Increase ?? item.increase;
}

function volumeForItem(item: TokenListItem) {
	return item.day1Vol ?? item.volume;
}

function toPctNumber(value?: string | number | null): number | null {
	if (value == null || value === "") return null;
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	return Math.abs(n) <= 1 ? n * 100 : n;
}

function isNewToken(createDate?: string | number | null) {
	const n = Number(createDate);
	if (!Number.isFinite(n) || n <= 0) return false;
	const ms = n > 1e12 ? n : n * 1000;
	return Date.now() - ms < 60 * 60 * 1000;
}

function Sparkline({ item }: { item: TokenListItem }) {
	const points = [
		toPctNumber(item.minIncrease),
		toPctNumber(item.min5Increase),
		toPctNumber(item.hourIncrease),
		toPctNumber(item.hour4Increase),
		toPctNumber(item.day1Increase ?? item.increase),
	].map((v) => (v == null ? 0 : v));

	const up = (points[points.length - 1] ?? 0) >= 0;
	const min = Math.min(...points, 0);
	const max = Math.max(...points, 0);
	const span = Math.max(max - min, 1e-6);
	const w = 72;
	const h = 28;
	const path = points
		.map((v, i) => {
			const x = (i / Math.max(points.length - 1, 1)) * w;
			const y = h - ((v - min) / span) * (h - 4) - 2;
			return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
		})
		.join(" ");

	return (
		<svg
			className={`mkt-spark ${up ? "up" : "down"}`}
			width={w}
			height={h}
			viewBox={`0 0 ${w} ${h}`}
			aria-hidden
		>
			<path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
		</svg>
	);
}

function ChangeCell({ value }: { value?: string | number | null }) {
	const n = toPctNumber(value);
	if (n == null) return <span className="mkt-muted">—</span>;
	const cls = n > 0 ? "up" : n < 0 ? "down" : "flat";
	return <span className={`mkt-chg ${cls}`}>{formatPct(value)}</span>;
}

function MarketTableSkeleton() {
	return (
		<div className="mkt-table-wrap">
			<table className="mkt-table">
				<tbody>
					{Array.from({ length: 8 }).map((_, i) => (
						<tr key={i}>
							<td className="mkt-col-token">
								<span className="mkt-token">
									<Skeleton circle width={36} height={36} />
									<span className="mkt-token-text">
										<Skeleton width="65%" height="0.95rem" />
										<Skeleton width="40%" height="0.75rem" />
									</span>
								</span>
							</td>
							<td className="mkt-num">
								<Skeleton width="70%" height="0.8rem" />
							</td>
							<td className="mkt-num">
								<Skeleton width="60%" height="0.8rem" />
							</td>
							<td className="mkt-num">
								<Skeleton width="70%" height="0.8rem" />
							</td>
							<td className="mkt-num">
								<Skeleton width="60%" height="0.8rem" />
							</td>
							<td className="mkt-num">
								<Skeleton width="70%" height="0.8rem" />
							</td>
							<td className="mkt-num">
								<Skeleton width="50%" height="0.8rem" />
							</td>
							<td className="mkt-spark-h">
								<Skeleton width={72} height="1.5rem" />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function TokenList() {
	const { href, t } = useI18n();
	const [tab, setTab] = useState<MarketTab>("new");
	const [period, setPeriod] = useState<Period>("1d");
	const [items, setItems] = useState<TokenListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async (nextTab: MarketTab) => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetchTokenList({
				pageIndex: 1,
				pageSize: 50,
				tab: nextTab,
			});
			if (res.code !== 0) throw new Error("load_failed");
			setItems(res.data || []);
		} catch {
			setError(t("error.load"));
			setItems([]);
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void load(tab);
	}, [tab, load]);

	const periodLabel = useMemo(
		() => PERIODS.find((p) => p.id === period)?.label ?? "1d",
		[period],
	);

	return (
		<div className="mkt">
			<div className="mkt-toolbar">
				<div className="mkt-tabs" role="tablist">
					{TABS.map((tabId) => (
						<button
							key={tabId}
							type="button"
							role="tab"
							aria-selected={tab === tabId}
							className={`mkt-tab${tab === tabId ? " active" : ""}`}
							onClick={() => setTab(tabId)}
						>
							{t(
								tabId === "new"
									? "market.new"
									: tabId === "soon"
										? "market.graduating"
										: "market.graduated",
							)}
						</button>
					))}
				</div>
				<div
					className="mkt-periods"
					role="group"
					aria-label={t("market.period")}
				>
					{PERIODS.map((p) => (
						<button
							key={p.id}
							type="button"
							className={`mkt-period${period === p.id ? " active" : ""}`}
							onClick={() => setPeriod(p.id)}
						>
							{p.label}
						</button>
					))}
				</div>
			</div>

			{error ? <p className="err mkt-status">{error}</p> : null}
			{!loading && !error && !items.length ? (
				<p className="muted mkt-status">{t("market.empty")}</p>
			) : null}

			{loading && !items.length ? <MarketTableSkeleton /> : null}

			{items.length ? (
				<div className="mkt-table-wrap">
					<table className="mkt-table">
						<thead>
							<tr>
								<th className="mkt-col-token">{t("market.token")}</th>
								<th className="mkt-num">{t("market.price")}</th>
								<th className="mkt-num">
									{t("market.periodChange", { period: periodLabel })}
								</th>
								<th className="mkt-num">{t("market.marketCap")}</th>
								<th className="mkt-num">{t("market.volume")}</th>
								<th className="mkt-num">
									{tab === "graduated"
										? t("market.holders")
										: t("market.progress")}
								</th>
								<th className="mkt-num">{t("market.age")}</th>
								<th className="mkt-spark-h">{t("market.trend")}</th>
							</tr>
						</thead>
						<tbody>
							{items.map((t) => {
								const onDex = isTokenOnDex(t.status);
								const progress = Number(t.progress);
								const progressPct =
									Number.isFinite(progress) && progress > 0
										? progress <= 1
											? progress * 100
											: progress
										: 0;
								const showNew = tab === "new" && isNewToken(t.createDate);

								return (
									<tr key={t.tokenAddress || t.tokenId}>
										<td className="mkt-col-token">
											<Link
												href={href(`/token/${t.tokenAddress}`)}
												className="mkt-token"
											>
												{/* eslint-disable-next-line @next/next/no-img-element */}
												<img
													src={imageUrl(t.img)}
													alt=""
													className="mkt-img"
												/>
												<span className="mkt-token-text">
													<span className="mkt-name-row">
														<strong className="mkt-name">
															{t.name || t.shortName}
														</strong>
														{showNew ? (
															<span className="mkt-new">NEW</span>
														) : null}
														{onDex ? (
															<span className="mkt-dex">DEX</span>
														) : null}
													</span>
													<span className="mkt-sub">
														${t.shortName}
														{t.symbol ? ` · ${t.symbol}` : ""}
													</span>
												</span>
											</Link>
										</td>
										<td className="mkt-num">
											<PriceText value={t.price} />
										</td>
										<td className="mkt-num">
											<ChangeCell value={changeForPeriod(t, period)} />
										</td>
										<td className="mkt-num">
											${formatCompact(t.cap)}
										</td>
										<td className="mkt-num">
											${formatCompact(volumeForItem(t))}
										</td>
										<td className="mkt-num">
											{tab === "graduated" || onDex ? (
												t.hold != null ? (
													Number(t.hold).toLocaleString()
												) : (
													<span className="mkt-muted">—</span>
												)
											) : (
												<span className="mkt-progress">
													<span className="mkt-progress-track">
														<span
															className="mkt-progress-bar"
															style={{
																width: `${Math.min(100, progressPct)}%`,
															}}
														/>
													</span>
													<span>{progressPct.toFixed(1)}%</span>
												</span>
											)}
										</td>
										<td className="mkt-num mkt-muted">
											{formatAge(t.createDate)}
										</td>
										<td className="mkt-spark-h">
											<Sparkline item={t} />
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : null}
		</div>
	);
}
