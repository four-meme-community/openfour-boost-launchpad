/**
 * Tax-template create: buy/sell rates, allocation sliders, recipient / dividend threshold.
 */
"use client";

import type { CSSProperties } from "react";
import {
	allocationTotal,
	type CreateTaxInfo,
} from "@/lib/create-tax";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/translations";

const ALLOC_FIELDS: {
	key: keyof CreateTaxInfo["taxTokenInfo"];
	label: TranslationKey;
}[] = [
	{ key: "fundsRecipient", label: "create.tax.recipient" },
	{ key: "divideToHolders", label: "create.tax.holders" },
	{ key: "burn", label: "create.tax.burn" },
	{ key: "addToLiquidity", label: "create.tax.liquidity" },
];

function clampPct(n: number): number {
	if (!Number.isFinite(n) || n < 0) return 0;
	if (n > 100) return 100;
	return Math.floor(n);
}

export function CreateTaxFields({
	value,
	onChange,
	quoteSymbol,
}: {
	value: CreateTaxInfo;
	onChange: (next: CreateTaxInfo) => void;
	quoteSymbol?: string;
}) {
	const { t } = useI18n();
	const total = allocationTotal(value.taxTokenInfo);
	const showWallet = Number(value.taxTokenInfo.fundsRecipient) > 0;
	const showMinShare = Number(value.taxTokenInfo.divideToHolders) > 0;

	const setRate = (side: "buy" | "sell", raw: string) => {
		const n = Number(raw);
		if (!Number.isFinite(n)) return;
		const clamped = Math.min(10, Math.max(0, Math.floor(n)));
		onChange({
			...value,
			[side === "buy" ? "taxFeeRateBuy" : "taxFeeRateSell"]: clamped,
		});
	};

	const blurRate = (side: "buy" | "sell") => {
		const cur =
			side === "buy" ? value.taxFeeRateBuy : value.taxFeeRateSell;
		const fallback =
			Number.isFinite(cur) && cur >= 1 && cur <= 10 ? cur : 1;
		onChange({
			...value,
			[side === "buy" ? "taxFeeRateBuy" : "taxFeeRateSell"]: fallback,
		});
	};

	const setAlloc = (
		key: keyof CreateTaxInfo["taxTokenInfo"],
		raw: number,
	) => {
		const others = ALLOC_FIELDS.filter((f) => f.key !== key).reduce(
			(sum, f) => sum + Number(value.taxTokenInfo[f.key] || 0),
			0,
		);
		const maxAllowed = Math.max(0, 100 - others);
		const n = Math.min(clampPct(raw), maxAllowed);
		onChange({
			...value,
			taxTokenInfo: { ...value.taxTokenInfo, [key]: n },
		});
	};

	return (
		<div className="create-tax">
			<p className="muted create-tax-hint">{t("create.tax.hint")}</p>

			<div className="create-tax-rates">
				<label>
					<span className="create-field-label">
						{t("create.tax.buyRate")}
						<em>1%–10%</em>
					</span>
					<div className="create-tax-rate-input">
						<input
							type="number"
							min={1}
							max={10}
							step={1}
							value={value.taxFeeRateBuy}
							onChange={(e) => setRate("buy", e.target.value)}
							onBlur={() => blurRate("buy")}
							required
						/>
						<span>%</span>
					</div>
				</label>
				<label>
					<span className="create-field-label">
						{t("create.tax.sellRate")}
						<em>1%–10%</em>
					</span>
					<div className="create-tax-rate-input">
						<input
							type="number"
							min={1}
							max={10}
							step={1}
							value={value.taxFeeRateSell}
							onChange={(e) => setRate("sell", e.target.value)}
							onBlur={() => blurRate("sell")}
							required
						/>
						<span>%</span>
					</div>
				</label>
			</div>

			<div className="create-tax-alloc">
				<div className="create-tax-alloc-head">
					<span>{t("create.tax.allocation")}</span>
					<span className={total === 100 ? "ok" : "err"}>
						{t("create.tax.total", { total })}
					</span>
				</div>
				<div className="create-tax-alloc-sliders">
					{ALLOC_FIELDS.map((f) => {
						const pct = Number(value.taxTokenInfo[f.key] || 0);
						return (
							<label key={f.key} className="create-tax-slider">
								<span className="create-tax-slider-head">
									<span>{t(f.label)}</span>
									<strong>{pct}%</strong>
								</span>
								<input
									type="range"
									min={0}
									max={100}
									step={1}
									value={pct}
									onChange={(e) => setAlloc(f.key, Number(e.target.value))}
									style={
										{
											"--pct": `${pct}%`,
										} as CSSProperties
									}
								/>
							</label>
						);
					})}
				</div>
			</div>

			{showMinShare ? (
				<label>
					{t("create.tax.minHolding")}
					<input
						type="number"
						min={10000}
						step={1}
						value={value.taxMinSharing}
						onChange={(e) => {
							const n = Number(e.target.value.replace(/[^\d]/g, ""));
							onChange({
								...value,
								taxMinSharing: Number.isFinite(n)
									? Math.min(1_000_000_000, n)
									: 10000,
							});
						}}
						onBlur={() => {
							if (Number(value.taxMinSharing) < 10000) {
								onChange({ ...value, taxMinSharing: 10000 });
							}
						}}
					/>
				</label>
			) : null}

			{showWallet ? (
				<label>
					<span className="create-field-label">
						{t("create.tax.wallet")}
						{quoteSymbol === "BNB" ? (
							<em>{t("create.tax.wbnb")}</em>
						) : null}
					</span>
					<input
						value={value.taxWalletAddress}
						onChange={(e) =>
							onChange({ ...value, taxWalletAddress: e.target.value.trim() })
						}
						placeholder="0x…"
						maxLength={42}
						required
					/>
				</label>
			) : null}
		</div>
	);
}
