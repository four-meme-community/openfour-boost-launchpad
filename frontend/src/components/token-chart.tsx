/**
 * Token detail candles: Lightweight Charts + `/bar` history + BFF SSE live.
 */
"use client";

import {
	CandlestickSeries,
	ColorType,
	createChart,
	HistogramSeries,
	type IChartApi,
	type ISeriesApi,
	type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/skeleton";
import { subscribeBarStream } from "@/lib/bar-stream";
import { priceFormatFromValues } from "@/lib/format";
import {
	acceptRealtimeBar,
	barRealtimeCategory,
	fetchBars,
	type BarCandle,
	type BarTypeEnum,
} from "@/lib/meme-api";
import { useI18n } from "@/i18n/provider";

const INTERVALS: { label: string; value: BarTypeEnum }[] = [
	{ label: "1m", value: "MIN1" },
	{ label: "5m", value: "MIN5" },
	{ label: "15m", value: "MIN15" },
	{ label: "1h", value: "HOUR1" },
	{ label: "4h", value: "HOUR4" },
	{ label: "1D", value: "DAY1" },
];

/** Min candles in viewport; pad left when sparse so one bar is not stretched full-width */
const MIN_VISIBLE_BARS = 60;
const RIGHT_PAD_BARS = 8;
const FIXED_BAR_SPACING = 7;

function intervalSeconds(type: BarTypeEnum): number {
	switch (type) {
		case "MIN1":
			return 60;
		case "MIN5":
			return 300;
		case "MIN15":
			return 900;
		case "HOUR1":
			return 3600;
		case "HOUR4":
			return 14400;
		case "DAY1":
			return 86400;
		default:
			return 300;
	}
}

function applySparseFriendlyTimeScale(
	chart: IChartApi,
	candleCount: number,
	barInterval: BarTypeEnum,
	lastTime?: number,
) {
	const scale = chart.timeScale();
	if (candleCount <= 0) return;

	const applyRange = () => {
		if (candleCount >= MIN_VISIBLE_BARS) {
			scale.applyOptions({
				barSpacing: FIXED_BAR_SPACING,
				minBarSpacing: 2,
				rightOffset: RIGHT_PAD_BARS,
				lockVisibleTimeRangeOnResize: true,
			});
			scale.fitContent();
			return;
		}

		// Force fixed bar spacing + time-scale padding; no stretch when sparse
		scale.applyOptions({
			barSpacing: FIXED_BAR_SPACING,
			minBarSpacing: FIXED_BAR_SPACING,
			rightOffset: RIGHT_PAD_BARS,
			lockVisibleTimeRangeOnResize: true,
		});

		const step = intervalSeconds(barInterval);
		const end = Number(lastTime) || 0;
		if (end > 0) {
			const to = (end + step * RIGHT_PAD_BARS) as UTCTimestamp;
			const from = (end -
				step * (MIN_VISIBLE_BARS - 1)) as UTCTimestamp;
			try {
				scale.setVisibleRange({ from, to });
			} catch {
				scale.setVisibleLogicalRange({
					from: candleCount - MIN_VISIBLE_BARS,
					to: candleCount + RIGHT_PAD_BARS - 1,
				});
			}
		} else {
			scale.setVisibleLogicalRange({
				from: candleCount - MIN_VISIBLE_BARS,
				to: candleCount + RIGHT_PAD_BARS - 1,
			});
		}

		// fitContent-like logic may rewrite spacing — lock again
		scale.applyOptions({
			barSpacing: FIXED_BAR_SPACING,
			minBarSpacing: FIXED_BAR_SPACING,
		});
	};

	requestAnimationFrame(() => {
		applyRange();
		requestAnimationFrame(applyRange);
	});
}

type CandlePoint = {
	time: UTCTimestamp;
	open: number;
	high: number;
	low: number;
	close: number;
};

type VolumePoint = {
	time: UTCTimestamp;
	value: number;
	color: string;
};

function toUnixSec(createDate: string | number): UTCTimestamp {
	const n = Number(createDate);
	if (!Number.isFinite(n) || n <= 0) return 0 as UTCTimestamp;
	const sec = n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
	return sec as UTCTimestamp;
}

/**
 * Map upstream bars as-is (same as meme-launcher datafeed).
 * Do not flatten large jumps: DEX USDT conversion often has a legitimate
 * ~10–20× candle at graduation, which meme-launcher shows as the open spike.
 */
function mapBars(raw: BarCandle[]): {
	candles: CandlePoint[];
	volumes: VolumePoint[];
} {
	const byTime = new Map<number, CandlePoint>();
	const volByTime = new Map<number, VolumePoint>();

	for (const item of raw) {
		const time = toUnixSec(item.createDate);
		if (!time) continue;
		const open = Number(item.open);
		const high = Number(item.high);
		const low = Number(item.low);
		const close = Number(item.close);
		if (![open, high, low, close].every(Number.isFinite)) continue;

		byTime.set(time, { time, open, high, low, close });
		const volume = Number(item.volume ?? item.amount ?? 0);
		volByTime.set(time, {
			time,
			value: Number.isFinite(volume) ? volume : 0,
			color:
				close >= open
					? "rgba(108, 255, 50, 0.35)"
					: "rgba(255, 92, 92, 0.35)",
		});
	}

	const candles = [...byTime.values()].sort((a, b) => a.time - b.time);
	const volumes: VolumePoint[] = candles.map((candle) => {
		const vol = volByTime.get(candle.time);
		return {
			time: candle.time,
			value: vol?.value ?? 0,
			color:
				candle.close >= candle.open
					? "rgba(108, 255, 50, 0.35)"
					: "rgba(255, 92, 92, 0.35)",
		};
	});

	return { candles, volumes };
}

export function TokenChart({
	tokenId,
	onDex = false,
	raisedSymbol,
	onLastPrice,
}: {
	tokenId: number;
	/** Graduated to DEX (status TRADE) */
	onDex?: boolean;
	raisedSymbol?: string;
	onLastPrice?: (price: string | null) => void;
}) {
	const { t } = useI18n();
	const hostRef = useRef<HTMLDivElement | null>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
	const lastBarTimeRef = useRef<number>(0);
	const onLastPriceRef = useRef(onLastPrice);
	onLastPriceRef.current = onLastPrice;

	const [barInterval, setBarInterval] = useState<BarTypeEnum>("MIN5");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [empty, setEmpty] = useState(false);
	const [live, setLive] = useState(false);
	/** DEX bars in USDT — same as meme-launcher when chart quote is USDT. */
	const quoteMode = "USDT" as const;
	const expectedCategory = barRealtimeCategory({
		onDex,
		quoteMode,
		raisedSymbol,
	});

	useEffect(() => {
		const el = hostRef.current;
		if (!el) return;

		// Axis labels are Canvas-drawn (no CSS cascade) — pass the font explicitly
		// or the chart falls back to its default, mismatching JetBrains Mono elsewhere.
		const monoFont =
			getComputedStyle(document.documentElement)
				.getPropertyValue("--font-mono")
				.trim() || "ui-monospace, monospace";

		const chart = createChart(el, {
			autoSize: true,
			layout: {
				background: { type: ColorType.Solid, color: "#0a0a0a" },
				textColor: "#8a8a8a",
				fontSize: 12,
				fontFamily: monoFont,
			},
			grid: {
				vertLines: { color: "rgba(255,255,255,0.04)" },
				horzLines: { color: "rgba(255,255,255,0.04)" },
			},
			rightPriceScale: {
				visible: true,
				borderVisible: false,
				entireTextOnly: false,
				scaleMargins: { top: 0.08, bottom: 0.22 },
			},
			leftPriceScale: {
				visible: false,
			},
			timeScale: {
				borderVisible: false,
				timeVisible: true,
				secondsVisible: false,
				barSpacing: FIXED_BAR_SPACING,
				minBarSpacing: 2,
				rightOffset: RIGHT_PAD_BARS,
				lockVisibleTimeRangeOnResize: true,
			},
			crosshair: {
				mode: 1,
			},
		});

		const candles = chart.addSeries(CandlestickSeries, {
			upColor: "#6cff32",
			downColor: "#ff5c5c",
			borderVisible: false,
			wickUpColor: "#6cff32",
			wickDownColor: "#ff5c5c",
			priceScaleId: "right",
			priceFormat: { type: "price", precision: 12, minMove: 1e-12 },
		});
		const volumes = chart.addSeries(HistogramSeries, {
			priceFormat: { type: "volume" },
			priceScaleId: "volume",
		});
		chart.priceScale("right").applyOptions({
			visible: true,
			autoScale: true,
			borderVisible: false,
		});
		chart.priceScale("volume").applyOptions({
			scaleMargins: { top: 0.8, bottom: 0 },
		});

		chartRef.current = chart;
		candleRef.current = candles;
		volumeRef.current = volumes;

		return () => {
			chart.remove();
			chartRef.current = null;
			candleRef.current = null;
			volumeRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!tokenId) return;
		let cancelled = false;
		let unsubscribeStream: (() => void) | undefined;

		(async () => {
			setLoading(true);
			setError(null);
			setEmpty(false);
			setLive(false);
			lastBarTimeRef.current = 0;
			try {
				const raw = await fetchBars({
					tokenId,
					typeEnum: barInterval,
					onDex,
					quoteMode,
					pageSize: 400,
					startDate: onDex ? undefined : 1,
				});
				if (cancelled) return;
				const { candles, volumes } = mapBars(raw);
				const fmt = priceFormatFromValues(
					candles.flatMap((c) => [c.open, c.high, c.low, c.close]),
				);
				candleRef.current?.applyOptions({ priceFormat: fmt });
				candleRef.current?.setData(candles);
				volumeRef.current?.setData(volumes);
				setEmpty(candles.length === 0);
				const last = candles.at(-1);
				lastBarTimeRef.current = last?.time ?? 0;
				const closeText =
					last?.close != null && Number.isFinite(last.close)
						? String(last.close)
						: null;
				onLastPriceRef.current?.(closeText);
				if (chartRef.current) {
					applySparseFriendlyTimeScale(
						chartRef.current,
						candles.length,
						barInterval,
						last?.time,
					);
				}
				chartRef.current?.priceScale("right").applyOptions({
					autoScale: true,
					visible: true,
				});

				unsubscribeStream = subscribeBarStream(
					{ tokenId, typeEnum: barInterval },
					{
						onReady: () => {
							if (!cancelled) setLive(true);
						},
						onBar: (bar) => {
							if (cancelled) return;
							if (
								!acceptRealtimeBar({
									onDex,
									expectedCategory,
									barCategory: bar.category,
								})
							) {
								return;
							}
							const time = toUnixSec(bar.createDate);
							if (!time || time < lastBarTimeRef.current) return;

							const open = Number(bar.open);
							const high = Number(bar.high);
							const low = Number(bar.low);
							const close = Number(bar.close);
							const volume = Number(bar.volume ?? 0);
							if (![open, high, low, close].every(Number.isFinite)) return;

							lastBarTimeRef.current = time;
							candleRef.current?.update({
								time,
								open,
								high,
								low,
								close,
							});
							volumeRef.current?.update({
								time,
								value: Number.isFinite(volume) ? volume : 0,
								color:
									close >= open
										? "rgba(108, 255, 50, 0.35)"
										: "rgba(255, 92, 92, 0.35)",
							});
							onLastPriceRef.current?.(String(close));
							setEmpty(false);
						},
						onError: () => {
							if (!cancelled) setLive(false);
						},
					},
				);
			} catch {
				if (!cancelled) {
					setError(t("error.chart"));
					candleRef.current?.setData([]);
					volumeRef.current?.setData([]);
					onLastPriceRef.current?.(null);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
			unsubscribeStream?.();
		};
	}, [tokenId, barInterval, onDex, expectedCategory, quoteMode, t]);

	return (
		<section className="token-chart">
			<div className="chart-toolbar">
				<div className="chart-heading">
					<span className={live ? "chart-live on" : "chart-live"}>
						{live ? t("common.live") : t("chart.history")}
					</span>
					<span className="chart-market">
						{onDex ? "DEX" : "Bonding"}
					</span>
				</div>
				<div className="tabs">
					{INTERVALS.map((item) => (
						<button
							key={item.value}
							type="button"
							className={barInterval === item.value ? "tab active" : "tab"}
							onClick={() => setBarInterval(item.value)}
						>
							{item.label}
						</button>
					))}
				</div>
			</div>
			<div className="chart-shell">
				<div ref={hostRef} className="chart-canvas" />
				{loading ? <Skeleton className="chart-skeleton" /> : null}
				{!loading && empty ? (
					<div className="chart-overlay chart-overlay--empty muted">
						<svg
							width="34"
							height="34"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden
						>
							<path d="M3 3v16a2 2 0 0 0 2 2h16" />
							<path
								d="M7 14l3-3 3 2 5-6"
								strokeDasharray="2.5 2.5"
								opacity="0.6"
							/>
						</svg>
						<p>{t("chart.empty")}</p>
					</div>
				) : null}
				{error ? <p className="chart-overlay err">{error}</p> : null}
			</div>
		</section>
	);
}
