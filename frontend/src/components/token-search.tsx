/**
 * Home search: trigger bar + floating modal (Esc / overlay / `/` shortcut).
 * Results use partner token search; no tags / buy / history chrome.
 */
"use client";

import Link from "next/link";
import {
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { PriceText } from "@/components/price-text";
import { Skeleton } from "@/components/skeleton";
import { useQuoteTickerPrices } from "@/hooks/use-quote-ticker-prices";
import { useI18n } from "@/i18n/provider";
import {
	formatAddress,
	formatAge,
	formatCompact,
} from "@/lib/format";
import {
	fetchTokenList,
	imageUrl,
	isTokenOnDex,
	type TokenListItem,
} from "@/lib/meme-api";
import { toUsdMarketCap, toUsdPrice } from "@/lib/quote-usd";

function SearchIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
			<path
				d="M7.25 12.5a5.25 5.25 0 1 1 0-10.5 5.25 5.25 0 0 1 0 10.5Z"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				d="M11.1 11.1 14 14"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function TokenSearch() {
	const { t, href } = useI18n();
	const { priceOf } = useQuoteTickerPrices();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [debounced, setDebounced] = useState("");
	const [items, setItems] = useState<TokenListItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const titleId = useId();

	const close = useCallback(() => {
		setOpen(false);
		setQuery("");
		setDebounced("");
		setItems([]);
		setError(null);
	}, []);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const typing =
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable);
			if (event.key === "/" && !event.metaKey && !event.ctrlKey && !typing) {
				event.preventDefault();
				setOpen(true);
				return;
			}
			if (event.key === "Escape" && open) {
				event.preventDefault();
				close();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [close, open]);

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
		return () => {
			document.body.style.overflow = prev;
			window.clearTimeout(timer);
		};
	}, [open]);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebounced(query.trim()), 280);
		return () => window.clearTimeout(timer);
	}, [query]);

	useEffect(() => {
		if (!open) return;
		if (!debounced) {
			setItems([]);
			setLoading(false);
			setError(null);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		void (async () => {
			try {
				const res = await fetchTokenList({
					pageIndex: 1,
					pageSize: 20,
					tab: "new",
					keyword: debounced,
				});
				if (cancelled) return;
				if (res.code !== 0) throw new Error("search_failed");
				setItems(res.data || []);
			} catch {
				if (!cancelled) {
					setItems([]);
					setError(t("error.load"));
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [debounced, open, t]);

	return (
		<>
			<button
				type="button"
				className="token-search-trigger"
				onClick={() => setOpen(true)}
				aria-haspopup="dialog"
			>
				<span className="token-search-trigger-icon" aria-hidden>
					<SearchIcon />
				</span>
				<span className="token-search-trigger-placeholder">
					{t("market.search")}
				</span>
				<kbd className="token-search-kbd">/</kbd>
			</button>

			{open ? (
				<div className="token-search-overlay" role="presentation">
					<button
						type="button"
						className="token-search-backdrop"
						aria-label={t("common.close")}
						onClick={close}
					/>
					<div
						className="token-search-modal"
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
					>
						<div className="token-search-modal-bar">
							<span className="token-search-trigger-icon" aria-hidden>
								<SearchIcon />
							</span>
							<input
								ref={inputRef}
								id={titleId}
								className="token-search-input"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder={t("market.searchHint")}
								autoComplete="off"
								spellCheck={false}
							/>
							<kbd className="token-search-kbd">Esc</kbd>
						</div>

						<div className="token-search-body">
							{!debounced ? (
								<p className="muted token-search-hint">
									{t("market.searchHint")}
								</p>
							) : null}

							{debounced && loading ? (
								<div className="token-search-list">
									{Array.from({ length: 4 }).map((_, i) => (
										<div key={i} className="token-search-row skel">
											<Skeleton circle width={40} height={40} />
											<div className="token-search-row-main">
												<Skeleton width="45%" height="0.85rem" />
												<Skeleton width="30%" height="0.7rem" />
											</div>
										</div>
									))}
								</div>
							) : null}

							{debounced && !loading && error ? (
								<p className="err">{error}</p>
							) : null}

							{debounced && !loading && !error && items.length === 0 ? (
								<p className="muted">{t("market.empty")}</p>
							) : null}

							{debounced && !loading && items.length > 0 ? (
								<div className="token-search-list">
									{items.map((item) => {
										const onDex = isTokenOnDex(item.status);
										const quoteUsd = priceOf(item.symbol);
										const marketCapUsd = toUsdMarketCap(item.cap, {
											onDex,
											quoteUsd,
										});
										const priceUsd = toUsdPrice(item.price, {
											onDex,
											quoteUsd,
										});
										return (
											<Link
												key={item.tokenAddress || item.tokenId}
												href={href(`/token/${item.tokenAddress}`)}
												className="token-search-row"
												onClick={close}
											>
												{/* eslint-disable-next-line @next/next/no-img-element */}
												<img
													src={imageUrl(item.img)}
													alt=""
													className="token-search-img"
												/>
												<div className="token-search-row-main">
													<strong>
														{item.shortName || item.name}
														{item.name && item.shortName !== item.name ? (
															<span className="muted"> {item.name}</span>
														) : null}
													</strong>
													<span className="muted">
														{formatAge(item.createDate)}
														{" · "}
														{formatAddress(item.tokenAddress, 4)}
													</span>
												</div>
												<div className="token-search-row-metrics">
													<span>
														<span className="muted">MC </span>$
														{formatCompact(marketCapUsd)}
													</span>
													<span>
														<span className="muted">P </span>
														<PriceText value={priceUsd} />
													</span>
												</div>
											</Link>
										);
									})}
								</div>
							) : null}
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
