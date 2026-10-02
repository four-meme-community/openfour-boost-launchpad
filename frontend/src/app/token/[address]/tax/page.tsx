/**
 * Token tax detail: allocation + my holdings/claimable + claim history.
 *
 * Allocation is fully on-chain (`lib/tax-onchain.ts`, branched by `descriptor()`).
 * Do not rely on REST `GET .../token/token_tax` — it often returns no data for
 * taxed tokens; on-chain is the source of truth. REST fallback only when
 * `descriptor()` fails or returns an unknown template (rare).
 *
 * Claim path varies: token.tax / token.tax.stock call the token's own
 * `claimFee()` (verified on-chain), no signature / helper; other templates'
 * claim paths are unverified or N/A — see branch comments below.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { erc20Abi, isAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { readContract } from "wagmi/actions";
import { CopyAddress } from "@/components/copy-address";
import { DividendsPanel } from "@/components/dividends-panel";
import { TokenTaxSkeleton } from "@/components/token-tax-skeleton";
import { imageUrl, memeGet, type TokenDetail } from "@/lib/meme-api";
import { getActiveChain, toMemeApiNetworkCode } from "@/lib/chain";
import { loadTemplateConfig } from "@/lib/open-four";
import { useCommonConfig } from "@/hooks/use-common-config";
import { wagmiConfig } from "@/lib/wagmi";
import { fetchTaxConfig, type TokenTaxConfig } from "@/lib/tax-api";
import { claimTaxFeeDirect, claimTaxFeeForOthers, claimTaxFees, readClaimableFees } from "@/lib/tax-claim";
import {
	readOnchainClaimable,
	readOnchainClaimedTotal,
	readOnchainTaxInfo,
	type OnchainTaxInfo,
} from "@/lib/tax-onchain";
import { formatBalanceWei, useErc20Balance } from "@/hooks/use-token-balance";
import { useTokenTradeFlags } from "@/hooks/use-token-trade-flags";
import { formatAddress, formatAge, formatNum } from "@/lib/format";
import { useI18n } from "@/i18n/provider";

/** Upstream may send percent (3) or fraction (0.03) — accept both */
function toPct(value?: number | string | null): number {
	if (value == null || value === "") return 0;
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return n <= 1 ? n * 100 : n;
}

function AllocationBar({ config }: { config: TokenTaxConfig }) {
	const { t } = useI18n();
	const segments = [
		{ key: "burn", label: t("tax.burn"), pct: toPct(config.burnRate), className: "burn" },
		{ key: "liquidity", label: t("tax.liquidity"), pct: toPct(config.liquidityRate), className: "liquidity" },
		{ key: "holders", label: t("tax.holders"), pct: toPct(config.divideRate), className: "holders" },
		{ key: "recipient", label: t("tax.recipient"), pct: toPct(config.recipientRate), className: "recipient" },
	].filter((s) => s.pct > 0);

	return (
		<div className="tax-allocation">
			<div className="tax-allocation-bar">
				{segments.map((s) => (
					<div
						key={s.key}
						className={`tax-allocation-seg tax-allocation-seg--${s.className}`}
						style={{ width: `${s.pct}%` }}
						title={`${s.label}: ${s.pct.toFixed(1)}%`}
					/>
				))}
			</div>
			<div className="tax-allocation-legend">
				{segments.map((s) => (
					<div key={s.key} className="tax-allocation-legend-item">
						<span className={`tax-allocation-dot tax-allocation-seg--${s.className}`} />
						<span className="muted">{s.label}</span>
						<strong>{s.pct.toFixed(1)}%</strong>
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * Show each fact only when its allocation share is actually non-zero — e.g. the
 * recipient address still has a default (creator) when rateFounder=0 but no tax
 * ever goes there, so showing it misleads; same for burn / min balance gates.
 * Min balance / burned amounts are in this token's units — use token decimals
 * (not quote decimals). On-chain `minShare` compares to `balanceOf(account)`;
 * `tokenBurned` is burned token quantity.
 */
function AllocationFacts({
	config,
	tokenDecimals,
	tokenSymbol,
}: {
	config: TokenTaxConfig;
	/** On-chain reads are raw units and need token decimals; REST fallback scale is
	 *  uncertain — when omitted, show as human-readable without guessing */
	tokenDecimals?: number;
	/** Min balance is this token's units — append its symbol so the unit is clear */
	tokenSymbol?: string;
}) {
	const { t } = useI18n();
	const hasHolderShare = toPct(config.divideRate) > 0;
	const hasRecipientShare = toPct(config.recipientRate) > 0;
	const hasBurnShare = toPct(config.burnRate) > 0;

	/** REST fallback values may not be integer strings — only on-chain paths scaled
	 *  by token decimals are safe as BigInt; both paths check numeric zero first */
	const minSharingNum = config.minSharing != null ? Number(config.minSharing) : null;
	const isZeroMinSharing = minSharingNum === 0;

	return (
		<dl className="tax-facts">
			{hasHolderShare && config.minSharing != null ? (
				<>
					<dt>{t("tax.minHolding")}</dt>
					<dd>
						{isZeroMinSharing
							? t("tax.noMinimum")
							: `${
									tokenDecimals != null
										? formatBalanceWei(BigInt(config.minSharing), tokenDecimals)
										: formatNum(config.minSharing, 0)
								}${tokenSymbol ? ` ${tokenSymbol}` : ""}`}
					</dd>
				</>
			) : null}
			{hasRecipientShare && config.recipientAddress ? (
				<>
					<dt>{t("tax.recipientAddress")}</dt>
					<dd>
						<CopyAddress value={config.recipientAddress} className="token-addr tax-addr-copy" />
					</dd>
				</>
			) : null}
			{hasBurnShare && config.feeBurn != null ? (
				<>
					<dt>{t("tax.totalBurned")}</dt>
					<dd>
						{tokenDecimals != null
							? formatBalanceWei(BigInt(config.feeBurn), tokenDecimals)
							: formatNum(config.feeBurn, 2)}
					</dd>
				</>
			) : null}
			{config.lastFeeDispatchTime ? (
				<>
					<dt>{t("tax.lastDispatch")}</dt>
					<dd>{formatAge(config.lastFeeDispatchTime)}</dd>
				</>
			) : null}
		</dl>
	);
}

export default function TokenTaxPage() {
	const { t } = useI18n();
	const { displayOf } = useCommonConfig();
	const params = useParams<{ address: string }>();
	const address = params.address;
	const { address: account } = useAccount();

	const [token, setToken] = useState<TokenDetail | null>(null);
	const [taxInfo, setTaxInfo] = useState<OnchainTaxInfo | null>(null);
	/** These three REST fallback states are only used when taxInfo.kind === "unknown" */
	const [config, setConfig] = useState<TokenTaxConfig | null>(null);
	const [configLoaded, setConfigLoaded] = useState(false);
	const [configError, setConfigError] = useState<string | null>(null);
	const [claimable, setClaimable] = useState<bigint | null>(null);
	/** Lifetime claimed total via on-chain `claimedFee` — not per-claim details */
	const [claimedTotal, setClaimedTotal] = useState<bigint | null>(null);
	/** Claimable dividends are quote-denominated, not this token's decimals */
	const [quoteDecimals, setQuoteDecimals] = useState(18);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const [othersOpen, setOthersOpen] = useState(false);
	const [othersInput, setOthersInput] = useState("");
	const [othersBusy, setOthersBusy] = useState(false);
	const [othersMessage, setOthersMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const validAddress = !!address && isAddress(address);
	const balanceQuery = useErc20Balance(account, validAddress ? (address as Address) : null);
	/** Shared buy/sell rate fallback (same as detail header badges); creator_rewards overrides with on-chain merged rates below */
	const taxFlags = useTokenTradeFlags(validAddress ? address : null);

	useEffect(() => {
		if (!validAddress) return;
		let cancelled = false;
		(async () => {
			try {
				const networkCode = toMemeApiNetworkCode();
				const res = await memeGet<TokenDetail>("/meme-api/api/v1/public/token", {
					address,
					networkCode,
				});
				if (cancelled) return;
				if (res.code !== 0) throw new Error("load_failed");

				/**
				 * `public/token` has no image (docs confirm `image`/`img` only on
				 * `public/token/detail`); detail header loads it the same way —
				 * copy that pattern or the avatar stays empty.
				 */
				let merged = res.data;
				try {
					const detailRes = await memeGet<{ image?: string }>(
						"/meme-api/api/v1/public/token/detail",
						{ address, networkCode },
					);
					if (!cancelled && detailRes.code === 0 && detailRes.data?.image) {
						merged = { ...merged, image: detailRes.data.image };
					}
				} catch {
					// Missing image → placeholder block; tax info still fine
				}
				if (cancelled) return;
				setToken(merged);

				/**
				 * REST `shortName` is often empty (page used to fall back to full `name`).
				 * Detail header (`app/token/[address]/page.tsx`) proved reading ERC20
				 * `symbol()` is more reliable — same pattern here, non-blocking
				 * (on failure keep REST shortName/name; do not throw).
				 */
				void readContract(wagmiConfig, {
					address: address as Address,
					abi: erc20Abi,
					functionName: "symbol",
					chainId: getActiveChain().id,
				})
					.then((tokenSymbol) => {
						if (cancelled || !tokenSymbol) return;
						setToken((prev) => (prev ? { ...prev, shortName: String(tokenSymbol) } : prev));
					})
					.catch(() => {
						// On-chain read failed — keep REST shortName/name fallback
					});

				if (merged.symbol) {
					try {
						const symbols = await loadTemplateConfig();
						const quote = symbols.find((s) => s.symbol === merged.symbol);
						if (!cancelled && quote?.decimals != null) {
							setQuoteDecimals(quote.decimals);
						}
					} catch {
						// Default to 18 if missing — display may be slightly off vs true decimals
					}
				}

				const info = await readOnchainTaxInfo(address as Address);
				if (cancelled) return;
				setTaxInfo(info);

				if (info.kind === "unknown") {
					const tokenId = Number(res.data?.id ?? res.data?.tokenId);
					try {
						const cfgRes = await fetchTaxConfig({
							tokenId: Number.isFinite(tokenId) && tokenId > 0 ? tokenId : undefined,
							address,
						});
						if (cancelled) return;
						if (cfgRes.code === 0) {
							setConfig(cfgRes.data ?? null);
						} else {
							setConfigError(cfgRes.msg || t("error.load"));
						}
					} catch {
						if (!cancelled) setConfigError(t("error.load"));
					} finally {
						if (!cancelled) setConfigLoaded(true);
					}
				}
			} catch {
				if (!cancelled) setError(t("error.load"));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [address, validAddress, t]);

	const reloadClaimable = useCallback(async () => {
		if (!account || !validAddress || !taxInfo) return;
		if (taxInfo.kind === "unknown") {
			// Unknown template: fall back to prior on-chain claimableFee read
			try {
				const [value] = await readClaimableFees([address as Address], account);
				setClaimable(value);
			} catch {
				setClaimable(null);
			}
			return;
		}
		try {
			const value = await readOnchainClaimable(taxInfo, account);
			setClaimable(value);
		} catch {
			setClaimable(null);
		}
	}, [account, address, validAddress, taxInfo]);

	const reloadClaimedTotal = useCallback(async () => {
		if (!account || !taxInfo) return;
		try {
			setClaimedTotal(await readOnchainClaimedTotal(taxInfo, account));
		} catch {
			setClaimedTotal(null);
		}
	}, [account, taxInfo]);

	useEffect(() => {
		void reloadClaimable();
		void reloadClaimedTotal();
	}, [reloadClaimable, reloadClaimedTotal]);

	const onClaim = async () => {
		if (!account || !validAddress || !taxInfo) {
			setMessage({ type: "error", text: t("tax.signIn") });
			return;
		}
		setMessage(null);
		setBusy(true);
		try {
			let hash: Address;
			if (taxInfo.kind === "tax") {
				hash = await claimTaxFeeDirect(address as Address, account);
			} else {
				// strategy / unknown: try shared FeeClaimHelper (unverified); fail loudly
				const result = await claimTaxFees([address as Address], account);
				hash = result.hashes[0];
			}
			setMessage({ type: "success", text: t("tax.claimed", { hash: formatAddress(hash, 6) }) });
			await Promise.all([reloadClaimable(), reloadClaimedTotal(), balanceQuery.refetch()]);
		} catch {
			setMessage({ type: "error", text: t("tax.claimFailed") });
		} finally {
			setBusy(false);
		}
	};

	/** `claimFee(address[])` verified only for kind==="tax" (TaxToken/Stock4TaxToken) */
	const onClaimForOthers = async () => {
		if (!account || !validAddress || taxInfo?.kind !== "tax") return;
		const accounts = othersInput
			.split(/[\s,]+/)
			.map((s) => s.trim())
			.filter(Boolean)
			.filter((s, i, arr) => arr.indexOf(s) === i) as Address[];
		const invalid = accounts.filter((a) => !isAddress(a));
		if (accounts.length === 0 || invalid.length > 0) {
			setOthersMessage({ type: "error", text: t("tax.claimForOthersInvalid") });
			return;
		}
		setOthersMessage(null);
		setOthersBusy(true);
		try {
			const hash = await claimTaxFeeForOthers(address as Address, accounts, account);
			setOthersMessage({
				type: "success",
				text: t("tax.claimForOthersSuccess", { count: accounts.length, hash: formatAddress(hash, 6) }),
			});
			setOthersInput("");
		} catch {
			setOthersMessage({ type: "error", text: t("tax.claimFailed") });
		} finally {
			setOthersBusy(false);
		}
	};

	if (error) return <p className="err">{error}</p>;
	if (!token || !taxInfo) return <TokenTaxSkeleton />;

	const tokenSymbol = token.shortName || token.name;
	const quoteLabel = displayOf(token.symbol) || token.symbol || "BNB";
	const pair = `${tokenSymbol} / ${quoteLabel}`;
	const hasClaimable = claimable != null && claimable > 0n;
	const canClaim = taxInfo.kind === "tax" || taxInfo.kind === "strategy" || taxInfo.kind === "unknown";
	/** Min balance / burned use this token's decimals (live on-chain, fallback 18) */
	const tokenDecimals = balanceQuery.data?.decimals ?? 18;

	const combinedPct =
		taxInfo.kind === "creator_rewards" ? taxInfo.combinedFeeRate / 100 : null;

	return (
		<div className="tax-page-grid">
			<section className="tax-page">
				<div className="tax-header">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src={imageUrl(token.image || token.img)} alt="" className="token-img xl" />
				<div className="tax-header-identity">
					<h1 className="token-title">{pair}</h1>
					<CopyAddress value={token.address} className="token-addr tax-addr-copy tax-header-address" />
				</div>
				<div className="tax-header-rates">
					<div className="tax-rate-stat">
						<span className="muted">
							{combinedPct != null ? t("tax.combinedTax") : t("tax.buyTax")}
						</span>
						<strong>
							{combinedPct != null
								? `${combinedPct.toFixed(1)}%`
								: taxFlags.loading
									? "…"
									: `${taxFlags.feeRateBuy.toFixed(1)}%`}
						</strong>
					</div>
					{combinedPct == null ? (
						<div className="tax-rate-stat">
							<span className="muted">{t("tax.sellTax")}</span>
							<strong>{taxFlags.loading ? "…" : `${taxFlags.feeRateSell.toFixed(1)}%`}</strong>
						</div>
					) : null}
				</div>
			</div>

			{taxInfo.kind === "tax" ? (
				<div className="card tax-card">
					<h2>{t("tax.allocation")}</h2>
					<AllocationBar config={taxInfo.allocation} />
					<AllocationFacts config={taxInfo.allocation} tokenDecimals={tokenDecimals} tokenSymbol={tokenSymbol} />
					<dl className="tax-facts">
						<dt>{t("tax.totalTaxCollected")}</dt>
						<dd>
							{formatBalanceWei(taxInfo.totalTaxCollected, quoteDecimals)} {quoteLabel}
						</dd>
						<dt>{t("tax.pendingDistribution")}</dt>
						<dd>
							{formatBalanceWei(taxInfo.feeAccumulated, quoteDecimals)} {quoteLabel}
						</dd>
					</dl>
				</div>
			) : taxInfo.kind === "strategy" ? (
				taxInfo.allocation ? (
					<div className="card tax-card">
						<h2>{t("tax.allocation")}</h2>
						<AllocationBar config={taxInfo.allocation} />
						<AllocationFacts config={taxInfo.allocation} tokenDecimals={tokenDecimals} tokenSymbol={tokenSymbol} />
					</div>
				) : (
					<p className="muted tax-card">{t("tax.strategyUnsupported")}</p>
				)
			) : taxInfo.kind === "creator_rewards" ? (
				<div className="card tax-card">
					<h2>{t("tax.allocation")}</h2>
					<p className="muted">{t("tax.creatorRewardsNote")}</p>
					<dl className="tax-facts">
						<dt>{t("tax.recipientAddress")}</dt>
						<dd>
							<CopyAddress
								value={taxInfo.creator}
								display={formatAddress(taxInfo.creator, 5)}
								className="token-addr tax-addr-copy"
							/>
						</dd>
					</dl>
				</div>
			) : taxInfo.kind === "none" ? (
				<p className="muted tax-card">{t("tax.noTax")}</p>
			) : config ? (
				<div className="card tax-card">
					<h2>{t("tax.allocation")}</h2>
					<AllocationBar config={config} />
					<AllocationFacts config={config} tokenSymbol={tokenSymbol} />
				</div>
			) : configError ? (
				<p className="err tax-card">{configError}</p>
			) : !configLoaded ? (
				<p className="muted tax-card">{t("common.loading")}</p>
			) : taxFlags.feeRateBuy > 0 || taxFlags.feeRateSell > 0 ? (
				<p className="muted tax-card">{t("tax.allocationUnavailable")}</p>
			) : (
				<p className="muted tax-card">{t("tax.noTax")}</p>
			)}

			{canClaim ? (
				<div className="card tax-card tax-position">
					{/*
					 * Claimable amount uses quote decimals — `claimFee` pays out quote
					 * collected from trade tax (verified for TaxToken/Stock4TaxToken
					 * claimableFee). The "strategy" branch (StockDividendTaxStrategy)
					 * settlement asset is not field-verified; assume the same for now —
					 * if numbers look wrong, confirm that strategy contract's asset.
					 */}
					<h2>{t("tax.myPosition")}</h2>
					<div className="tax-position-stats">
						<div className="tax-position-stat">
							<span className="muted">{t("tax.yourBalance")}</span>
							<strong>
								{account
									? formatBalanceWei(
											balanceQuery.data?.value,
											balanceQuery.data?.decimals,
										)
									: "—"}{" "}
								{tokenSymbol}
							</strong>
						</div>
						<div className="tax-position-stat">
							<span className="muted">{t("tax.claimable")}</span>
							<strong className={hasClaimable ? "chg up" : undefined}>
								{claimable != null ? formatBalanceWei(claimable, quoteDecimals) : "—"}{" "}
								{quoteLabel}
							</strong>
						</div>
						{taxInfo.kind === "tax" ? (
							<div className="tax-position-stat">
								<span className="muted">{t("tax.totalClaimed")}</span>
								<strong>
									{claimedTotal != null ? formatBalanceWei(claimedTotal, quoteDecimals) : "—"}{" "}
									{quoteLabel}
								</strong>
							</div>
						) : null}
					</div>
					<button
						type="button"
						className="btn tax-claim-btn"
						disabled={busy || !hasClaimable}
						onClick={onClaim}
					>
						{busy ? "…" : t("tax.claim")}
					</button>
					{message ? (
						<p className={message.type === "error" ? "err" : "ok"}>{message.text}</p>
					) : null}

					{taxInfo.kind === "tax" ? (
						<div className="tax-claim-others">
							<button
								type="button"
								className={`tax-claim-others-toggle${othersOpen ? " open" : ""}`}
								onClick={() => setOthersOpen((v) => !v)}
								aria-expanded={othersOpen}
							>
								{t("tax.claimForOthers")}
								<span className="tax-claim-others-chevron" aria-hidden="true" />
							</button>
							{othersOpen ? (
								<div className="tax-claim-others-body">
									<p className="muted">{t("tax.claimForOthersHint")}</p>
									<textarea
										className="tax-claim-others-input"
										rows={3}
										placeholder={t("tax.claimForOthersPlaceholder")}
										value={othersInput}
										onChange={(e) => setOthersInput(e.target.value)}
									/>
									<button
										type="button"
										className="btn"
										disabled={othersBusy || !othersInput.trim()}
										onClick={onClaimForOthers}
									>
										{othersBusy ? "…" : t("tax.claimForOthersButton")}
									</button>
									{othersMessage ? (
										<p className={othersMessage.type === "error" ? "err" : "ok"}>
											{othersMessage.text}
										</p>
									) : null}
								</div>
							) : null}
						</div>
					) : null}
				</div>
			) : null}

			</section>

			<aside className="tax-page-side">
				<DividendsPanel compact />
			</aside>
		</div>
	);
}
