/**
 * Fills: REST history + BFF SSE (`{tokenId}@FILL_EVENT@0`).
 */
"use client";

import { useEffect, useState } from "react";
import { PriceText } from "@/components/price-text";
import { Skeleton } from "@/components/skeleton";
import { subscribeFillStream } from "@/lib/fill-stream";
import {
	fetchTokenFills,
	type TokenFill,
} from "@/lib/meme-api";
import { useI18n } from "@/i18n/provider";
import {
	formatAddress,
	formatAge,
	formatCompact,
} from "@/lib/format";

function isBuy(side?: string) {
	const s = String(side || "").toUpperCase();
	return s === "BID" || s === "BUY";
}

function fillKey(f: TokenFill) {
	return f.txHash || `${f.userAddress}-${f.createDate}-${f.side}-${f.amount}`;
}

export function TokenFills({
	tokenId,
	quoteSymbol,
}: {
	tokenId: number;
	quoteSymbol?: string;
}) {
	const { t } = useI18n();
	const [items, setItems] = useState<TokenFill[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [live, setLive] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		setItems([]);
		(async () => {
			try {
				const res = await fetchTokenFills({ tokenId, pageSize: 50 });
				if (cancelled) return;
				if (res.code !== 0) throw new Error("load_failed");
				setItems(res.data || []);
			} catch {
				if (!cancelled) {
					setError(t("error.load"));
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [tokenId, t]);

	useEffect(() => {
		const unsub = subscribeFillStream(
			{ tokenId },
			{
				onReady: () => setLive(true),
				onFill: (fill) => {
					setItems((prev) => {
						const key = fillKey(fill);
						if (prev.some((x) => fillKey(x) === key)) return prev;
						return [fill, ...prev].slice(0, 80);
					});
				},
				onError: () => setLive(false),
			},
		);
		return () => {
			unsub();
			setLive(false);
		};
	}, [tokenId]);

	if (loading) {
		return (
			<div className="fills">
				<div className="fills-body">
					{Array.from({ length: 8 }).map((_, i) => (
						<div className="fill-row" key={i}>
							<Skeleton width="80%" height="0.75rem" />
							<Skeleton width="70%" height="0.75rem" />
							<Skeleton width="60%" height="0.75rem" />
							<Skeleton width="75%" height="0.75rem" />
							<Skeleton width="65%" height="0.75rem" />
							<Skeleton width="65%" height="0.75rem" />
						</div>
					))}
				</div>
			</div>
		);
	}
	if (error) return <p className="err">{error}</p>;
	if (!items.length) return <p className="muted">{t("fills.empty")}</p>;

	const quote = quoteSymbol || "BNB";

	return (
		<div className={`fills${live ? " is-live" : ""}`}>
			<div className="fills-head">
				<span>
					{t("fills.wallet")}
					{live ? <em className="fills-live">{t("common.live")}</em> : null}
				</span>
				<span>{t("fills.time")}</span>
				<span>{t("fills.type")}</span>
				<span>{t("fills.price")}</span>
				<span>{t("fills.amount")}</span>
				<span>{quote}</span>
			</div>
			<div className="fills-body">
				{items.map((f) => {
					const buy = isBuy(f.side);
					return (
						<a
							key={fillKey(f)}
							className={`fill-row ${buy ? "buy" : "sell"}`}
							href={`https://bscscan.com/tx/${String(f.txHash).split("-")[0]}`}
							target="_blank"
							rel="noreferrer"
						>
							<span className="muted fill-wallet">
								{formatAddress(f.userAddress, 3)}
							</span>
							<span className="muted">{formatAge(f.createDate)}</span>
							<span className={buy ? "up" : "down"}>
								{buy ? t("trade.buy") : t("trade.sell")}
							</span>
							<span>
								<PriceText value={f.price} prefixDollar={false} />
							</span>
							<span>{formatCompact(f.amount, 3)}</span>
							<span>{formatCompact(f.volume, 4)}</span>
						</a>
					);
				})}
			</div>
		</div>
	);
}
