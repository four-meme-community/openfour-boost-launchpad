/**
 * Trade panel: screenshot layout + bonding V12 / external ZapRouter (Pancake V2 fallback).
 */
"use client";

import BigNumber from "bignumber.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatEther, parseEther, type Address } from "viem";
import { useAccount } from "wagmi";
import {
	formatBalanceWei,
	useErc20Balance,
	useNativeBalance,
} from "@/hooks/use-token-balance";
import { useToast } from "@/components/toast";
import {
	quoteExactIn,
	resolveBuyPath,
	resolveSellPath,
	swapExactIn,
	WBNB,
} from "@/lib/dex-v2";
import {
	buyTokenV12,
	estimateBuyByBudget,
	estimateSell,
	loadContracts,
	loadTemplateConfig,
	sellTokenV12,
} from "@/lib/open-four";
import {
	readMigrateModuleTag,
	resolveZapDexRoute,
	type TokenZapMeta,
	type ZapRoute,
} from "@/lib/zap-route";
import {
	canUseZap,
	executeZapExactIn,
	quoteZapExactIn,
	readTokenTaxBps,
	resolveZapRouterAddress,
	type ZapQuote,
} from "@/lib/zap-trade";
import {
	DEFAULT_TRADE_SETTINGS,
	loadTradeSettings,
	saveTradeSettings,
	type GasMode,
	type TradeSettings,
} from "@/lib/trade-settings";
import { buildTxGas } from "@/lib/tx-gas";
import { useI18n } from "@/i18n/provider";

const PCTS = [0.25, 0.5, 0.75, 1] as const;
const GAS_MODES: GasMode[] = ["MARKET", "FAST", "TURBO", "CUSTOM"];

function clampAmount(raw: string) {
	const m = raw.match(/^\d*(\.?\d{0,9})/);
	return m?.[0] ?? "";
}

function fmtEther(wei: bigint, dp = 6) {
	const n = new BigNumber(formatEther(wei));
	if (n.isZero()) return "0";
	return n.decimalPlaces(dp, BigNumber.ROUND_DOWN).toFixed();
}

function fmtHuman(v: string | number, dp = 6) {
	const n = new BigNumber(v || 0);
	if (!n.isFinite() || n.isZero()) return "0";
	return n.decimalPlaces(dp, BigNumber.ROUND_DOWN).toFixed();
}

type DexSource = "zap" | "pancake-v2" | null;

export function TradePanel({
	tokenAddress,
	quoteSymbol,
	tokenSymbol,
	onDex = false,
	tokenMeta,
}: {
	tokenAddress: Address;
	quoteSymbol: string;
	tokenSymbol: string;
	onDex?: boolean;
	tokenMeta?: TokenZapMeta | null;
}) {
	const { t } = useI18n();
	const { address, isConnected } = useAccount();
	const toast = useToast();
	const [side, setSide] = useState<"buy" | "sell">("buy");
	const [amount, setAmount] = useState("");
	const [payWithBnb, setPayWithBnb] = useState(false);
	const [settings, setSettings] = useState<TradeSettings>(DEFAULT_TRADE_SETTINGS);
	const [draft, setDraft] = useState<TradeSettings>(DEFAULT_TRADE_SETTINGS);
	const [showSettings, setShowSettings] = useState(false);
	const [previewOut, setPreviewOut] = useState("0");
	const [busy, setBusy] = useState(false);
	const [core, setCore] = useState<Address | null>(null);
	const [tools, setTools] = useState<Address | null>(null);
	const [quoteAsset, setQuoteAsset] = useState<Address | null>(null);
	const [zapRouter, setZapRouter] = useState<Address | null>(null);
	const [zapRoute, setZapRoute] = useState<ZapRoute | null>(null);
	const [taxBps, setTaxBps] = useState({ buy: 0, sell: 0 });
	const [dexSource, setDexSource] = useState<DexSource>(null);
	const zapQuoteRef = useRef<ZapQuote | null>(null);

	useEffect(() => {
		const loaded = loadTradeSettings();
		setSettings(loaded);
		setDraft(loaded);
	}, []);

	const slippage = settings.slippage;

	const quoteIsBnb = quoteSymbol === "BNB";
	// ZapRouter external supports native BNB only; non-BNB quotes default to "Pay with BNB" externally
	const settleNative = quoteIsBnb || payWithBnb;
	const options = settleNative ? 2n : 0n;
	const inputSymbol =
		side === "sell" ? tokenSymbol : settleNative ? "BNB" : quoteSymbol;
	const receiveSymbol =
		side === "buy" ? tokenSymbol : settleNative ? "BNB" : quoteSymbol;

	useEffect(() => {
		if (quoteIsBnb) setPayWithBnb(false);
		else if (onDex) setPayWithBnb(true);
	}, [quoteIsBnb, onDex]);

	useEffect(() => {
		Promise.all([loadContracts(), loadTemplateConfig()])
			.then(async ([c, symbols]) => {
				setCore(c.OpenFourCore);
				setTools(c.OpenFourTools);
				const quote =
					symbols.find((item) => item.symbol === quoteSymbol) ||
					symbols.find(
						(item) =>
							(item as { nativeSymbol?: string }).nativeSymbol ===
							quoteSymbol,
					);
				const addr = quote?.symbolAddress as Address | undefined;
				// BNB quote uses WBNB address for routing only; balance is native
				setQuoteAsset(
					quoteSymbol === "BNB" ? WBNB : addr || null,
				);
				const router = await resolveZapRouterAddress(c.OpenFourCore);
				setZapRouter(router);
			})
			.catch(() => toast.error(t("error.contractLoad")));
	}, [quoteSymbol, t, toast]);

	useEffect(() => {
		if (!onDex) {
			setZapRoute(null);
			return;
		}
		let cancelled = false;
		(async () => {
			const tag =
				tokenMeta?.migrateModuleTag ||
				tokenMeta?.migrateTag ||
				(await readMigrateModuleTag(tokenAddress));
			const route = resolveZapDexRoute({
				tokenData: tokenMeta,
				migrateModuleTag: tag,
				wrappedNative: WBNB,
				quoteAsset,
			});
			if (!cancelled) setZapRoute(route);
			if (route && Number(route.dexType) === 1) {
				const tax = await readTokenTaxBps(tokenAddress);
				if (!cancelled) setTaxBps(tax);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [onDex, tokenAddress, tokenMeta, quoteAsset]);

	const {
		data: nativeBal,
		refetch: refetchNative,
		isFetching: nativeFetching,
	} = useNativeBalance(address);
	const {
		data: quoteBal,
		refetch: refetchQuote,
	} = useErc20Balance(
		address,
		quoteIsBnb ? null : quoteAsset,
	);
	const {
		data: tokenBal,
		refetch: refetchToken,
	} = useErc20Balance(address, tokenAddress);

	const settlementBalWei = useMemo(() => {
		if (side === "sell") return tokenBal?.value ?? 0n;
		if (settleNative) return nativeBal?.value ?? 0n;
		return quoteBal?.value ?? 0n;
	}, [side, settleNative, tokenBal, nativeBal, quoteBal]);

	const settlementDecimals =
		side === "sell"
			? (tokenBal?.decimals ?? 18)
			: settleNative
				? (nativeBal?.decimals ?? 18)
				: (quoteBal?.decimals ?? 18);

	const settlementBalHuman = formatBalanceWei(
		settlementBalWei,
		settlementDecimals,
	);
	const balanceLabelSymbol =
		side === "sell" ? tokenSymbol : settleNative ? "BNB" : quoteSymbol;
	const balancePending =
		!!address &&
		((side === "buy" && settleNative && nativeFetching && !nativeBal) ||
			false);

	const zapReady = useMemo(
		() =>
			canUseZap({
				zapRouter,
				token: tokenAddress,
				route: zapRoute,
			}),
		[zapRouter, tokenAddress, zapRoute],
	);

	const inputError = useMemo(() => {
		if (!amount || !(Number(amount) > 0)) return null;
		if (new BigNumber(amount).gt(settlementBalHuman)) {
			return t("error.insufficientBalance");
		}
		return null;
	}, [amount, settlementBalHuman, t]);

	useEffect(() => {
		if (!address || !amount || !(Number(amount) > 0)) {
			setPreviewOut("0");
			zapQuoteRef.current = null;
			setDexSource(null);
			return;
		}
		let cancelled = false;
		const timer = setTimeout(async () => {
			try {
				const amountWei = parseEther(amount);
				if (onDex) {
					// Prefer ZapRouter (native BNB settlement)
					if (settleNative && zapReady && zapRouter && zapRoute) {
						const quote = await quoteZapExactIn({
							account: address,
							zapRouter,
							token: tokenAddress,
							route: zapRoute,
							side,
							amountIn: amountWei,
							buyTaxBps: taxBps.buy,
							sellTaxBps: taxBps.sell,
						});
						if (cancelled) return;
						if (quote) {
							zapQuoteRef.current = quote;
							setDexSource("zap");
							setPreviewOut(fmtEther(quote.amountOut));
							return;
						}
					}
					zapQuoteRef.current = null;
					const path =
						side === "buy"
							? await resolveBuyPath({
									token: tokenAddress,
									quoteAsset,
									useNative: settleNative,
								})
							: await resolveSellPath({
									token: tokenAddress,
									quoteAsset,
									useNative: settleNative,
								});
					if (!path) {
						if (!cancelled) {
							setPreviewOut("0");
							setDexSource(null);
						}
						return;
					}
					const out = await quoteExactIn(amountWei, path);
					if (cancelled) return;
					setDexSource("pancake-v2");
					setPreviewOut(fmtEther(out));
					return;
				}
				if (!tools) return;
				if (side === "buy") {
					const est = await estimateBuyByBudget({
						tools,
						token: tokenAddress,
						user: address,
						budgetEth: amount,
						options,
					});
					if (!cancelled) setPreviewOut(fmtEther(est.tokenAmount));
				} else {
					const est = await estimateSell({
						tools,
						token: tokenAddress,
						user: address,
						amount: amountWei,
						options,
					});
					if (!cancelled) setPreviewOut(fmtEther(est.userReceives));
				}
			} catch {
				if (!cancelled) {
					setPreviewOut("0");
					zapQuoteRef.current = null;
					setDexSource(null);
				}
			}
		}, 450);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [
		amount,
		side,
		tools,
		address,
		tokenAddress,
		options,
		onDex,
		quoteAsset,
		settleNative,
		zapReady,
		zapRouter,
		zapRoute,
		taxBps.buy,
		taxBps.sell,
	]);

	const setPct = (pct: number) => {
		if (settlementBalWei <= 0n) {
			setAmount("0");
			return;
		}
		setAmount(
			new BigNumber(
				formatBalanceWei(settlementBalWei, settlementDecimals, 9),
			)
				.times(pct)
				.toFixed(6, BigNumber.ROUND_DOWN),
		);
	};

	const refreshBals = async () => {
		await Promise.all([refetchNative(), refetchQuote(), refetchToken()]);
	};

	const tradeDex = async (amountWei: bigint) => {
		if (!address) throw new Error("Connect wallet first");
		const gas = await buildTxGas(settings);

		if (settleNative && zapReady && zapRouter && zapRoute) {
			let quote = zapQuoteRef.current;
			if (!quote || quote.amountIn !== amountWei) {
				quote = await quoteZapExactIn({
					account: address,
					zapRouter,
					token: tokenAddress,
					route: zapRoute,
					side,
					amountIn: amountWei,
					buyTaxBps: taxBps.buy,
					sellTaxBps: taxBps.sell,
				});
			}
			if (quote) {
				const hash = await executeZapExactIn({
					account: address,
					zapRouter,
					token: tokenAddress,
					route: zapRoute,
					side,
					quote,
					slippage,
					buyTaxBps: taxBps.buy,
					...gas,
				});
				setDexSource("zap");
				return hash;
			}
		}

		const path =
			side === "buy"
				? await resolveBuyPath({
						token: tokenAddress,
						quoteAsset,
						useNative: settleNative,
					})
				: await resolveSellPath({
						token: tokenAddress,
						quoteAsset,
						useNative: settleNative,
					});
		if (!path) throw new Error("No liquidity path available");
		const out = await quoteExactIn(amountWei, path);
		if (out <= 0n) throw new Error("Quote failed — try again shortly");
		const slipPct = new BigNumber(slippage || 0).div(100);
		const minOut = BigInt(
			new BigNumber(out.toString())
				.times(new BigNumber(1).minus(slipPct))
				.integerValue(BigNumber.ROUND_DOWN)
				.toFixed(0),
		);
		const hash = await swapExactIn({
			account: address,
			amountIn: amountWei,
			amountOutMin: minOut,
			path,
			payNative: side === "buy" && settleNative,
			...gas,
		});
		setDexSource("pancake-v2");
		return hash;
	};

	const onTrade = async () => {
		if (!isConnected || !address) {
			toast.error(t("error.connectWallet"));
			return;
		}
		if (!amount || !(Number(amount) > 0)) {
			toast.error(t("error.invalidAmount"));
			return;
		}
		if (inputError) {
			toast.error(inputError);
			return;
		}
		setBusy(true);
		try {
			const amountWei = parseEther(amount);
			const slipPct = new BigNumber(slippage || 0).div(100);

			if (onDex) {
				const hash = await tradeDex(amountWei);
				toast.success(t("trade.success", { hash: hash.slice(0, 10) }));
				setAmount("");
				await refreshBals();
				return;
			}

			if (!core || !tools) throw new Error("Contracts not loaded");
			if (!settleNative && !quoteAsset) {
				throw new Error(`Missing quote asset config: ${quoteSymbol}`);
			}
			const gas = await buildTxGas(settings);

			if (side === "buy") {
				const est = await estimateBuyByBudget({
					tools,
					token: tokenAddress,
					user: address,
					budgetEth: amount,
					options,
				});
				const maxQuote = settleNative
					? est.curveQuote + est.totalFee
					: BigInt(
							new BigNumber(est.userPays.toString())
								.times(new BigNumber(1).plus(slipPct))
								.integerValue(BigNumber.ROUND_UP)
								.toFixed(0),
						);
				const hash = await buyTokenV12({
					core,
					account: address,
					token: tokenAddress,
					tokenAmount: est.tokenAmount,
					maxQuote,
					value: settleNative ? amountWei : 0n,
					options,
					quoteAsset: quoteAsset ?? undefined,
					...gas,
				});
				toast.success(t("trade.buySuccess", { hash: hash.slice(0, 10) }));
			} else {
				const est = await estimateSell({
					tools,
					token: tokenAddress,
					user: address,
					amount: amountWei,
					options,
				});
				const minQuote = BigInt(
					new BigNumber(est.userReceives.toString())
						.times(new BigNumber(1).minus(slipPct))
						.integerValue(BigNumber.ROUND_DOWN)
						.toFixed(0),
				);
				const hash = await sellTokenV12({
					core,
					account: address,
					token: tokenAddress,
					tokenAmount: amountWei,
					minQuote,
					options,
					...gas,
				});
				toast.success(t("trade.sellSuccess", { hash: hash.slice(0, 10) }));
			}
			setAmount("");
			await refreshBals();
		} catch {
			toast.error(t("error.transaction"));
		} finally {
			setBusy(false);
		}
	};

	const buyActive = side === "buy";
	const modeHint = !onDex
		? t("trade.internal")
		: dexSource === "zap" || (settleNative && zapReady)
			? t("trade.externalZap")
			: t("trade.externalV2");

	return (
		<section className="trade-panel">
			<div className="trade-panel__mode muted">{modeHint}</div>

			<div className="trade-tabs">
				<button
					type="button"
					className={buyActive ? "trade-tab trade-tab--buy active" : "trade-tab"}
					onClick={() => {
						setSide("buy");
						setAmount("");
					}}
				>
					{t("trade.buy")}
				</button>
				<button
					type="button"
					className={
						!buyActive ? "trade-tab trade-tab--sell active" : "trade-tab"
					}
					onClick={() => {
						setSide("sell");
						setAmount("");
					}}
				>
					{t("trade.sell")}
				</button>
			</div>

			<div className="trade-meta">
				<span className="trade-balance">
					{t("trade.balance")}:{" "}
					{!address
						? "—"
						: balancePending
							? "…"
							: settlementBalHuman}{" "}
					{balanceLabelSymbol}
				</span>
				<div className="trade-meta__right">
					{!quoteIsBnb ? (
						<label className="trade-bnb-pay">
							<span>
								{side === "buy" ? t("trade.payBnb") : t("trade.receiveBnb")}
							</span>
							<input
								type="checkbox"
								checked={payWithBnb}
								onChange={(e) => {
									setPayWithBnb(e.target.checked);
									setAmount("");
								}}
							/>
						</label>
					) : null}
					<button
						type="button"
						className="trade-slip-btn"
						aria-label={t("trade.settings")}
						onClick={() => {
							setDraft(settings);
							setShowSettings((v) => !v);
						}}
						title={`${t("trade.slippage")} ${settings.slippage}% · Gas ${settings.gasMode}`}
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							aria-hidden
						>
							<path
								d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="round"
							/>
						</svg>
					</button>
				</div>
			</div>

			{showSettings ? (
				<div className="trade-settings">
					<div className="trade-settings__row">
						<label className="trade-settings__label">
							{t("trade.slippage")}
						</label>
						<input
							type="number"
							min={0}
							max={50}
							step={0.1}
							value={draft.slippage}
							onChange={(e) =>
								setDraft((d) => ({
									...d,
									slippage: Number(e.target.value) || 0,
								}))
							}
						/>
					</div>
					<div className="trade-settings__row">
						<span className="trade-settings__label">
							{t("trade.gasPrice")}
						</span>
						<div className="trade-gas-modes">
							{GAS_MODES.map((mode) => (
								<button
									key={mode}
									type="button"
									className={
										draft.gasMode === mode
											? "trade-gas-mode active"
											: "trade-gas-mode"
									}
									onClick={() =>
										setDraft((d) => ({ ...d, gasMode: mode }))
									}
								>
									{t(
										mode === "MARKET"
											? "trade.marketGas"
											: mode === "FAST"
												? "trade.fastGas"
												: mode === "TURBO"
													? "trade.turboGas"
													: "trade.custom",
									)}
								</button>
							))}
						</div>
					</div>
					{draft.gasMode === "CUSTOM" ? (
						<div className="trade-settings__row">
							<label className="trade-settings__label">
								{t("trade.customGwei")}
							</label>
							<input
								type="number"
								min={0.05}
								step={0.05}
								value={draft.gasGwei}
								onChange={(e) =>
									setDraft((d) => ({ ...d, gasGwei: e.target.value }))
								}
							/>
						</div>
					) : null}
					<div className="trade-settings__row">
						<label className="trade-settings__label">
							{t("trade.maxGas")}
							<span className="muted">{t("trade.autoHint")}</span>
						</label>
						<input
							type="text"
							inputMode="numeric"
							placeholder={t("trade.auto")}
							value={draft.maxGas}
							onChange={(e) =>
								setDraft((d) => ({
									...d,
									maxGas: e.target.value.replace(/[^\d]/g, ""),
								}))
							}
						/>
					</div>
					<button
						type="button"
						className="btn trade-settings__save"
						onClick={() => {
							if (draft.gasMode === "CUSTOM") {
								const g = Number(draft.gasGwei);
								if (!Number.isFinite(g) || g <= 0) {
									toast.error(t("error.invalidGas"));
									return;
								}
							}
							saveTradeSettings(draft);
							setSettings(draft);
							setShowSettings(false);
						}}
					>
						{t("trade.saveSettings")}
					</button>
				</div>
			) : null}

			<div className="trade-input">
				<input
					value={amount}
					placeholder="0"
					inputMode="decimal"
					onChange={(e) => setAmount(clampAmount(e.target.value))}
				/>
				<span className="trade-input__sym">{inputSymbol}</span>
			</div>

			<div className="trade-pcts">
				{PCTS.map((p) => (
					<button
						key={p}
						type="button"
						className="trade-pct"
						onClick={() => setPct(p)}
					>
						{p * 100}%
					</button>
				))}
			</div>

			<button
				type="button"
				className={
					buyActive
						? "trade-submit trade-submit--buy"
						: "trade-submit trade-submit--sell"
				}
				disabled={busy || !isConnected}
				onClick={onTrade}
			>
				{busy
					? t("trade.confirming")
					: !isConnected
						? t("wallet.connect")
						: buyActive
							? t("trade.buy")
							: t("trade.sell")}
			</button>

			<p className="trade-receive">
				{t("trade.receive")}: {fmtHuman(previewOut)} ${receiveSymbol}
			</p>

			{inputError ? <p className="err">{inputError}</p> : null}
		</section>
	);
}
