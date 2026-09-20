/**
 * Tax-template create: royalty template, buy/sell rates, allocation, unverified ForwardVault UI.
 */
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Address, Hex } from "viem";
import { CreateUnverifiedTaxVaultForm } from "@/components/create-unverified-tax-vault-form";
import { Skeleton } from "@/components/skeleton";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/translations";
import {
	allocationTotal,
	type CreateTaxInfo,
} from "@/lib/create-tax";
import {
	defaultFormFromSchema,
	encodeModuleParams,
	type ModuleSchema,
} from "@/lib/open-four-encode";
import { loadContracts } from "@/lib/open-four";
import {
	DEFAULT_TAX_VAULT_SELECTION,
	isCustomRoyalty,
	isForwardVaultSchema,
	isUnverifiedRoyalty,
	loadTaxVaultRegistryAddress,
	loadVaultTypeEncodeSchema,
	loadVaultTypeList,
	NO_TAX_VAULT_TYPE_ID,
	UNVERIFIED_ROYALTY_TYPE_ID,
	type SchemaLoadStatus,
	type TaxVaultTypeView,
} from "@/lib/tax-vault";

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

function safeEncode(
	schema: ModuleSchema,
	form: Record<string, unknown>,
): Hex | null {
	try {
		return encodeModuleParams(schema, form);
	} catch {
		return null;
	}
}

function RoyaltyCardsSkeleton() {
	return (
		<div className="create-quote-grid" aria-hidden>
			{Array.from({ length: 2 }, (_, index) => (
				<div
					key={index}
					className="create-quote-card create-mode-card create-quote-skel skeleton-shimmer"
				>
					<span className="create-quote-meta">
						<Skeleton width="72%" height="0.9rem" />
						<Skeleton width="54%" height="0.7rem" />
					</span>
				</div>
			))}
		</div>
	);
}

function UnverifiedSchemaSkeleton() {
	return (
		<div className="create-tax-skel" aria-busy="true" aria-hidden>
			<Skeleton width="70%" height="0.75rem" />
			<div className="create-tax-skel-field">
				<Skeleton width="40%" height="0.7rem" />
				<Skeleton width="100%" height="2.4rem" />
			</div>
			<div className="create-tax-skel-field">
				<Skeleton width="45%" height="0.7rem" />
				<Skeleton width="100%" height="2.4rem" />
			</div>
			<div className="create-tax-skel-field">
				<Skeleton width="35%" height="0.7rem" />
				<Skeleton width="100%" height="2.4rem" />
			</div>
		</div>
	);
}

type RoyaltyOption = {
	typeId: Hex;
	labelKey: TranslationKey;
	descKey: TranslationKey;
	hintKey: TranslationKey;
};

export function CreateTaxFields({
	value,
	onChange,
	quoteSymbol,
}: {
	value: CreateTaxInfo;
	onChange: (
		next: CreateTaxInfo | ((prev: CreateTaxInfo) => CreateTaxInfo),
	) => void;
	quoteSymbol?: string;
}) {
	const { t } = useI18n();
	const total = allocationTotal(value.taxTokenInfo);
	const vault = value.taxVault ?? DEFAULT_TAX_VAULT_SELECTION;
	const selectedTypeId = vault.typeId;
	const isCustom = isCustomRoyalty(selectedTypeId);
	const showWallet =
		isCustom && Number(value.taxTokenInfo.fundsRecipient) > 0;
	const showMinShare = Number(value.taxTokenInfo.divideToHolders) > 0;

	const [registry, setRegistry] = useState<Address | null>(null);
	const [vaultTypes, setVaultTypes] = useState<TaxVaultTypeView[]>([]);
	const [schema, setSchema] = useState<ModuleSchema | null>(null);
	const [initForm, setInitForm] = useState<Record<string, unknown>>({});
	const [loadingSchema, setLoadingSchema] = useState(false);
	const [loadingVaults, setLoadingVaults] = useState(true);

	const unverifiedRegistered = useMemo(
		() =>
			vaultTypes.some(
				(v) =>
					v.typeId.toLowerCase() === UNVERIFIED_ROYALTY_TYPE_ID.toLowerCase(),
			),
		[vaultTypes],
	);

	const royaltyOptions = useMemo((): RoyaltyOption[] => {
		const options: RoyaltyOption[] = [
			{
				typeId: NO_TAX_VAULT_TYPE_ID,
				labelKey: "create.tax.royalty.custom",
				descKey: "create.tax.royalty.customDesc",
				hintKey: "create.tax.royalty.customHint",
			},
		];
		if (unverifiedRegistered) {
			options.push({
				typeId: UNVERIFIED_ROYALTY_TYPE_ID,
				labelKey: "create.tax.royalty.unverified",
				descKey: "create.tax.royalty.unverifiedDesc",
				hintKey: "create.tax.royalty.unverifiedHint",
			});
		}
		return options;
	}, [unverifiedRegistered]);

	const isForwardVault = isForwardVaultSchema(schema);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoadingVaults(true);
			try {
				const contracts = await loadContracts();
				const tv = await loadTaxVaultRegistryAddress(
					contracts.OpenFourRegistry,
				);
				if (cancelled) return;
				setRegistry(tv);
				if (!tv) {
					setVaultTypes([]);
					return;
				}
				const list = await loadVaultTypeList(tv);
				if (!cancelled) setVaultTypes(list);
			} catch {
				if (!cancelled) {
					setRegistry(null);
					setVaultTypes([]);
				}
			} finally {
				if (!cancelled) setLoadingVaults(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (loadingVaults) return;
		if (
			royaltyOptions.length > 0 &&
			!royaltyOptions.some((o) => o.typeId === selectedTypeId)
		) {
			onChange((prev) => ({
				...prev,
				taxVault: { ...DEFAULT_TAX_VAULT_SELECTION },
			}));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [royaltyOptions, selectedTypeId, loadingVaults]);

	useEffect(() => {
		if (!registry) {
			setSchema(null);
			setInitForm({});
			setLoadingSchema(false);
			return;
		}
		if (isCustom) {
			setSchema(null);
			setInitForm({});
			setLoadingSchema(false);
			onChange((prev) => {
				const prevVault = prev.taxVault ?? DEFAULT_TAX_VAULT_SELECTION;
				if (
					prevVault.typeId === NO_TAX_VAULT_TYPE_ID &&
					prevVault.initParamsHex === "0x" &&
					prevVault.schemaLoadStatus === "valid"
				) {
					return prev;
				}
				return {
					...prev,
					taxVault: {
						typeId: NO_TAX_VAULT_TYPE_ID,
						initParamsHex: "0x",
						schemaLoadStatus: "valid",
					},
				};
			});
			return;
		}

		let cancelled = false;
		(async () => {
			setLoadingSchema(true);
			if (isUnverifiedRoyalty(selectedTypeId)) {
				onChange((prev) => ({
					...prev,
					taxVault: {
						typeId: selectedTypeId,
						initParamsHex: "0x",
						schemaLoadStatus: "loading",
					},
				}));
			}
			try {
				const next = await loadVaultTypeEncodeSchema(registry, selectedTypeId);
				if (cancelled) return;
				setSchema(next);
				const defaults = defaultFormFromSchema(next.params);
				setInitForm(defaults);
				const hex =
					next.params.length === 0
						? ("0x" as const)
						: safeEncode(next, defaults);
				if (!isUnverifiedRoyalty(selectedTypeId)) {
					onChange((prev) => ({
						...prev,
						taxVault: {
							typeId: selectedTypeId,
							initParamsHex: hex ?? "0x",
							schemaLoadStatus: "valid",
						},
					}));
				}
			} catch {
				if (!cancelled) {
					setSchema(null);
					setInitForm({});
					onChange((prev) => ({
						...prev,
						taxVault: {
							typeId: selectedTypeId,
							initParamsHex: "0x",
							schemaLoadStatus: "error",
						},
					}));
				}
			} finally {
				if (!cancelled) setLoadingSchema(false);
			}
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [registry, selectedTypeId, isCustom]);

	const patchVault = (
		next: Partial<CreateTaxInfo["taxVault"]> & { typeId?: Hex },
	) => {
		onChange((prev) => {
			const prevVault = prev.taxVault ?? DEFAULT_TAX_VAULT_SELECTION;
			return {
				...prev,
				taxVault: {
					...prevVault,
					...next,
					typeId: (next.typeId ?? prevVault.typeId) as Hex,
					initParamsHex: (next.initParamsHex ??
						prevVault.initParamsHex) as Hex,
					schemaLoadStatus:
						next.schemaLoadStatus ?? prevVault.schemaLoadStatus,
				},
			};
		});
	};

	const setRoyaltyType = (typeId: Hex) => {
		onChange((prev) => ({
			...prev,
			taxVault: {
				typeId,
				initParamsHex: "0x",
				schemaLoadStatus: isCustomRoyalty(typeId) ? "valid" : "loading",
			},
		}));
	};

	const handleInitFormChange = (patch: Record<string, unknown>) => {
		const nextForm = { ...initForm, ...patch };
		setInitForm(nextForm);
		if (!schema) return;
		const hex =
			schema.params.length === 0 ? ("0x" as const) : safeEncode(schema, nextForm);
		if (hex !== null) {
			patchVault({
				typeId: selectedTypeId,
				initParamsHex: hex,
			});
		}
	};

	const handleLoadStatus = (schemaLoadStatus: SchemaLoadStatus) => {
		patchVault({ typeId: selectedTypeId, schemaLoadStatus });
	};

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

	const currentOption =
		royaltyOptions.find((o) => o.typeId === selectedTypeId) ||
		royaltyOptions[0];

	return (
		<div className="create-tax">
			<p className="muted create-tax-hint">{t("create.tax.hint")}</p>

			<div className="create-tax-royalty">
				<span className="create-quote-label">
					{t("create.tax.royalty.template")}
				</span>
				{loadingVaults ? (
					<RoyaltyCardsSkeleton />
				) : (
					<div className="create-quote-grid" role="listbox">
						{royaltyOptions.map((opt) => {
							const active = selectedTypeId === opt.typeId;
							return (
								<button
									key={opt.typeId}
									type="button"
									role="option"
									aria-selected={active}
									className={`create-quote-card create-mode-card${active ? " active" : ""}`}
									onClick={() => setRoyaltyType(opt.typeId)}
								>
									<span className="create-quote-meta">
										<strong>{t(opt.labelKey)}</strong>
										<em>{t(opt.hintKey)}</em>
									</span>
								</button>
							);
						})}
					</div>
				)}

				{!loadingVaults && currentOption ? (
					<p className="muted create-tax-hint">{t(currentOption.descKey)}</p>
				) : null}

				{isUnverifiedRoyalty(selectedTypeId) ? (
					<div className="create-tax-unverified-block">
						{loadingSchema ? <UnverifiedSchemaSkeleton /> : null}
						{!loadingSchema && isForwardVault && schema ? (
							<CreateUnverifiedTaxVaultForm
								schema={schema}
								formData={initForm}
								update={handleInitFormChange}
								onLoadStatusChange={handleLoadStatus}
							/>
						) : null}
					</div>
				) : null}
			</div>

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
						const label =
							f.key === "fundsRecipient" && !isCustom
								? t("create.tax.royalty.walletShare")
								: t(f.label);
						return (
							<label key={f.key} className="create-tax-slider">
								<span className="create-tax-slider-head">
									<span>{label}</span>
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
						) : quoteSymbol === "ETH" ? (
							<em>{t("create.tax.weth")}</em>
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
