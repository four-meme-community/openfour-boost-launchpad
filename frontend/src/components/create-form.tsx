/**
 * OpenFour create form: stepped sections + right preview/summary.
 */
"use client";

import { Suspense, useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { CreateTaxFields } from "@/components/create-tax-fields";
import { Skeleton } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import { useAuth } from "@/hooks/auth-provider";
import { useSiteConfig } from "@/hooks/site-config";
import {
	DEFAULT_CREATE_TAX_INFO,
	validateCreateTaxInfo,
	type CreateTaxInfo,
} from "@/lib/create-tax";
import { isCustomRoyalty } from "@/lib/tax-vault";
import {
	createOpenFourToken,
	enrichRaisedWithLogos,
	isCreateQuoteNativePayment,
	isTaxTokenSchema,
	loadCommonConfig,
	loadContracts,
	loadSchemas,
	loadTemplateConfig,
	type TemplateSymbolConfig,
} from "@/lib/open-four";
import { formatAddress } from "@/lib/format";
import { imageUrl, uploadTokenImage } from "@/lib/meme-api";
import { isOptionalCreateUrlInputOk } from "@/lib/create-url";
import { parseChainQueryFromPath } from "@/i18n/locale-path";
import {
	formatBalanceWei,
	useErc20Balance,
	useNativeBalance,
} from "@/hooks/use-token-balance";
import { useI18n } from "@/i18n/provider";
import type { Address } from "viem";

const ACCEPTED_IMAGE_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const NAME_MAX = 50;
const TICKER_MAX = 10;
const DESC_MAX = 200;

function CreateSection({
	step,
	title,
	children,
}: {
	step: number;
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="create-section">
			<header className="create-section-head">
				<span className="create-step">{step}</span>
				<h2>{title}</h2>
			</header>
			<div className="create-section-body">{children}</div>
		</section>
	);
}

function QuoteCardSkeleton({ mode = false }: { mode?: boolean }) {
	return (
		<div
			className={`create-quote-card create-quote-skel skeleton-shimmer${mode ? " create-mode-card" : ""}`}
			aria-hidden
		>
			{mode ? null : <Skeleton circle width={34} height={34} />}
			<span className="create-quote-meta">
				<Skeleton width="72%" height="0.9rem" />
				<Skeleton width="54%" height="0.7rem" />
			</span>
		</div>
	);
}

export function CreateForm() {
	return (
		<Suspense fallback={<CreateFormInnerFallback />}>
			<CreateFormInner />
		</Suspense>
	);
}

function CreateFormInnerFallback() {
	return (
		<div className="create-layout create-layout--loading" aria-busy="true">
			<div className="create-main">
				<header className="create-hero">
					<div className="create-hero-copy">
						<Skeleton width={72} height="0.8rem" />
						<Skeleton width={220} height="2rem" />
						<Skeleton width="80%" height="0.9rem" />
					</div>
				</header>
				<CreateSection step={1} title="">
					<div className="create-basic-top">
						<Skeleton circle width={96} height={96} />
						<div className="create-basic-fields">
							<Skeleton height={40} />
							<Skeleton height={40} />
						</div>
					</div>
					<Skeleton height={88} />
				</CreateSection>
				<CreateSection step={2} title="">
					<div className="create-quote-grid">
						{Array.from({ length: 3 }, (_, index) => (
							<QuoteCardSkeleton key={index} />
						))}
					</div>
				</CreateSection>
				<Skeleton height={48} className="create-submit-skel" />
			</div>
			<aside className="create-aside">
				<section className="create-card create-preview-card">
					<Skeleton width={100} height="0.85rem" />
					<div className="create-preview-token">
						<Skeleton circle width={48} height={48} />
						<div className="create-preview-token-lines">
							<Skeleton width={120} height="0.95rem" />
							<Skeleton width={64} height="0.8rem" />
						</div>
					</div>
					<Skeleton width="55%" height="0.75rem" />
					<Skeleton width="100%" height={48} />
				</section>
				<section className="create-card create-summary-card">
					<Skeleton width={90} height="0.85rem" />
					{Array.from({ length: 4 }, (_, index) => (
						<div key={index} className="create-summary-skel-row">
							<Skeleton width={72} height="0.75rem" />
							<Skeleton width={96} height="0.75rem" />
						</div>
					))}
				</section>
			</aside>
		</div>
	);
}

function CreateFormInner() {
	const { href, t } = useI18n();
	const toast = useToast();
	const { address, isConnected } = useAccount();
	const { isAuthenticated, login } = useAuth();
	const router = useRouter();
	const pathname = usePathname();
	const { chains, defaultChain } = useSiteConfig();
	const currentChain = useMemo(() => {
		const query = parseChainQueryFromPath(pathname);
		return (
			chains.find(
				(item) =>
					item.query === query || item.id === query || item.key === query,
			) ||
			chains.find((item) => item.key === defaultChain) ||
			chains[0]
		);
	}, [chains, defaultChain, pathname]);
	const presetIds = useMemo(
		() =>
			(currentChain?.presetIds || []).map(String).filter(Boolean),
		[currentChain],
	);
	const [presetId, setPresetId] = useState(presetIds[0] || "");
	const templateId = Number(presetId);
	const showModePicker = presetIds.length > 1;
	const [raisedList, setRaisedList] = useState<TemplateSymbolConfig[]>([]);
	const [raised, setRaised] = useState<TemplateSymbolConfig | null>(null);
	const [isTaxTemplate, setIsTaxTemplate] = useState(false);
	const [taxByPresetId, setTaxByPresetId] = useState<Record<string, boolean>>(
		{},
	);
	const [name, setName] = useState("");
	const [shortName, setShortName] = useState("");
	const [desc, setDesc] = useState("");
	const [webUrl, setWebUrl] = useState("");
	const [twitterUrl, setTwitterUrl] = useState("");
	const [telegramUrl, setTelegramUrl] = useState("");
	const [feePlan, setFeePlan] = useState(true);
	const [taxInfo, setTaxInfo] = useState<CreateTaxInfo>(DEFAULT_CREATE_TAX_INFO);
	const [presaleQuote, setPresaleQuote] = useState("");
	const [imgUrl, setImgUrl] = useState("");
	const [imagePreview, setImagePreview] = useState("");
	const [uploading, setUploading] = useState(false);
	const [dragOver, setDragOver] = useState(false);
	const [busy, setBusy] = useState(false);
	const [configLoading, setConfigLoading] = useState(true);
	/** True when Core treats this quote as wrapped native (msg.value prebuy). */
	const [quotePaysNative, setQuotePaysNative] = useState(false);

	const {
		data: nativeBal,
		isFetching: nativeBalFetching,
	} = useNativeBalance(address);
	const {
		data: quoteBal,
		isFetching: quoteBalFetching,
	} = useErc20Balance(
		address,
		quotePaysNative ? null : (raised?.symbolAddress as Address | undefined),
	);

	useEffect(() => {
		if (presetIds.length === 0) return;
		if (!presetIds.includes(presetId)) {
			setPresetId(presetIds[0]);
		}
	}, [presetIds, presetId]);

	useEffect(() => {
		let cancelled = false;
		const addr = raised?.symbolAddress;
		if (!addr) {
			setQuotePaysNative(false);
			return;
		}
		isCreateQuoteNativePayment(addr).then((native) => {
			if (!cancelled) setQuotePaysNative(native);
		});
		return () => {
			cancelled = true;
		};
	}, [raised?.symbolAddress]);

	useEffect(() => {
		let cancelled = false;
		if (!Number.isFinite(templateId) || templateId <= 0) {
			setIsTaxTemplate(false);
			setConfigLoading(false);
			if (presetIds.length === 0) toast.error(t("error.config"));
			return;
		}
		setConfigLoading(true);
		(async () => {
			try {
				const [list, commonConfig, contracts] = await Promise.all([
					loadTemplateConfig(templateId),
					loadCommonConfig().catch(() => []),
					loadContracts(),
				]);
				if (cancelled) return;
				const enriched = enrichRaisedWithLogos(list, commonConfig);
				setRaisedList(enriched);
				setRaised((prev) => {
					const match = prev
						? enriched.find((item) => item.symbol === prev.symbol)
						: undefined;
					return match || enriched[0] || null;
				});

				const classifyIds = showModePicker ? presetIds : [String(templateId)];
				const flags = await Promise.all(
					classifyIds.map(async (id) => {
						const schemas = await loadSchemas(
							contracts.OpenFourTools,
							Number(id),
						);
						return [id, isTaxTokenSchema(schemas.token.params)] as const;
					}),
				);
				if (cancelled) return;
				const nextFlags = Object.fromEntries(flags);
				setTaxByPresetId((prev) => ({ ...prev, ...nextFlags }));
				setIsTaxTemplate(Boolean(nextFlags[String(templateId)]));
			} catch (err) {
				if (!cancelled) {
					setIsTaxTemplate(false);
					const detail =
						(err &&
						typeof err === "object" &&
						"shortMessage" in err &&
						typeof (err as { shortMessage?: unknown }).shortMessage ===
							"string"
							? (err as { shortMessage: string }).shortMessage
							: "") ||
						(err instanceof Error ? err.message : "") ||
						t("error.config");
					toast.error(detail);
				}
			} finally {
				if (!cancelled) setConfigLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [presetIds, showModePicker, t, templateId, toast]);

	useEffect(() => {
		if (!address) return;
		setTaxInfo((prev) =>
			prev.taxWalletAddress
				? prev
				: { ...prev, taxWalletAddress: address },
		);
	}, [address]);

	const uploadFile = async (file: File) => {
		if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
			toast.error(t("error.imageType"));
			return;
		}
		if (file.size > MAX_IMAGE_BYTES) {
			toast.error(t("error.imageSize"));
			return;
		}
		if (!isConnected || !address) {
			toast.error(t("error.connectBeforeUpload"));
			return;
		}

		setUploading(true);
		const localPreview = URL.createObjectURL(file);
		setImagePreview(localPreview);
		try {
			if (!isAuthenticated) await login();
			const uploadedUrl = await uploadTokenImage(file);
			setImgUrl(uploadedUrl);
			setImagePreview(imageUrl(uploadedUrl) ?? "");
		} catch {
			setImgUrl("");
			setImagePreview("");
			toast.error(t("error.imageUpload"));
		} finally {
			URL.revokeObjectURL(localPreview);
			setUploading(false);
		}
	};

	const onImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		await uploadFile(file);
	};

	const onDrop = async (event: DragEvent<HTMLLabelElement>) => {
		event.preventDefault();
		setDragOver(false);
		const file = event.dataTransfer.files?.[0];
		if (file) await uploadFile(file);
	};

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isConnected || !address) {
			toast.error(t("error.connectWallet"));
			return;
		}
		if (!isAuthenticated) {
			try {
				await login();
			} catch {
				toast.error(t("error.signIn"));
				return;
			}
		}
		if (!raised) {
			toast.error(t("error.quoteConfig"));
			return;
		}
		if (!name.trim() || !shortName.trim()) {
			toast.error(t("error.nameTicker"));
			return;
		}
		if (!desc.trim()) {
			toast.error(t("error.descRequired"));
			return;
		}
		if (!imgUrl) {
			toast.error(t("error.imageRequired"));
			return;
		}
		if (
			!isOptionalCreateUrlInputOk(webUrl) ||
			!isOptionalCreateUrlInputOk(twitterUrl) ||
			!isOptionalCreateUrlInputOk(telegramUrl)
		) {
			toast.error(t("error.invalidUrl"));
			return;
		}
		if (isTaxTemplate) {
			const taxErr = validateCreateTaxInfo(taxInfo);
			if (taxErr) {
				toast.error(t("error.taxConfig"));
				return;
			}
		}
		const prebuyNum = Number(presaleQuote);
		if (
			presaleQuote.trim() !== "" &&
			(!Number.isFinite(prebuyNum) || prebuyNum < 0)
		) {
			toast.error(t("error.invalidAmount"));
			return;
		}
		if (
			Number.isFinite(prebuyNum) &&
			prebuyNum > 0 &&
			Number(prebuyBalHuman) < prebuyNum
		) {
			toast.error(t("error.insufficientBalance"));
			return;
		}
		if (
			Number.isFinite(prebuyNum) &&
			prebuyNum > 0 &&
			raised.raisedAmount != null &&
			prebuyNum > Number(raised.raisedAmount)
		) {
			toast.error(t("error.prebuyMax"));
			return;
		}

		setBusy(true);
		try {
			const result = await createOpenFourToken({
				name: name.trim(),
				shortName: shortName.trim(),
				imgUrl,
				desc: desc.trim(),
				webUrl: webUrl.trim(),
				twitterUrl: twitterUrl.trim(),
				telegramUrl: telegramUrl.trim(),
				feePlan,
				presaleQuote: presaleQuote.trim() || "0",
				raised,
				account: address,
				templateId,
				tax: isTaxTemplate ? taxInfo : null,
			});
			toast.success(
				t("create.created", {
					id: result.tokenId,
					hash: result.hash,
				}),
			);
			if (result.address) {
				router.push(href(`/token/${result.address}`));
			}
		} catch (err) {
			const detail =
				err instanceof Error && err.message.trim() ? err.message : "";
			toast.error(detail || t("error.create"));
		} finally {
			setBusy(false);
		}
	};

	const previewName = name.trim() || t("create.placeholderName");
	const previewTicker = shortName.trim() || t("create.placeholderTicker");
	const nativeSymbol = currentChain?.nativeSymbol || "BNB";
	const raisedDisplay =
		raised?.nativeSymbol?.trim() || raised?.symbol || nativeSymbol;
	/** What the wallet actually spends for prebuy (native when quote==wrappedNative). */
	const prebuyPaySymbol = quotePaysNative
		? nativeSymbol
		: raisedDisplay;
	const prebuyBalWei = quotePaysNative
		? (nativeBal?.value ?? 0n)
		: (quoteBal?.value ?? 0n);
	const prebuyBalDecimals = quotePaysNative
		? (nativeBal?.decimals ?? 18)
		: (quoteBal?.decimals ?? 18);
	const prebuyBalHuman = formatBalanceWei(prebuyBalWei, prebuyBalDecimals);
	const prebuyBalPending =
		!!address &&
		((quotePaysNative && nativeBalFetching && !nativeBal) ||
			(!quotePaysNative && quoteBalFetching && !quoteBal));
	const modeLabel = isTaxTemplate
		? t("create.mode.tax")
		: t("create.mode.standard");
	const labelForPreset = (id: string) => {
		if (taxByPresetId[id] === true) return t("create.mode.tax");
		if (taxByPresetId[id] === false) return t("create.mode.standard");
		return t("create.bonding");
	};
	const hintForPreset = (id: string) => {
		if (taxByPresetId[id] === true) return t("create.mode.taxHint");
		if (taxByPresetId[id] === false) return t("create.mode.standardHint");
		return "";
	};

	return (
		<form className="create-layout" onSubmit={onSubmit}>
			<div className="create-main">
				<header className="create-hero">
					<div className="create-hero-copy">
						<p className="create-eyebrow">{t("create.eyebrow")}</p>
						<h1>{t("create.title")}</h1>
						<p className="muted">{t("create.description")}</p>
					</div>
				</header>

				{showModePicker ? (
					<div className="create-mode-block">
						<span className="create-quote-label">
							{t("create.section.mode")}
						</span>
						<div
							className="create-quote-grid"
							role="listbox"
							aria-busy={configLoading}
						>
							{configLoading &&
							!presetIds.every((id) => id in taxByPresetId)
								? presetIds.map((id) => (
										<QuoteCardSkeleton key={id} mode />
									))
								: presetIds.map((id) => {
										const active = presetId === id;
										return (
											<button
												key={id}
												type="button"
												role="option"
												aria-selected={active}
												className={`create-quote-card create-mode-card${active ? " active" : ""}`}
												onClick={() => setPresetId(id)}
												disabled={configLoading}
											>
												<span className="create-quote-meta">
													<strong>{labelForPreset(id)}</strong>
													{hintForPreset(id) ? (
														<em>{hintForPreset(id)}</em>
													) : null}
												</span>
											</button>
										);
									})}
						</div>
					</div>
				) : null}

				<CreateSection step={1} title={t("create.section.basic")}>
					<div className="create-basic-top">
						<div className="create-avatar-field">
							<span className="create-field-label">{t("create.image")}</span>
							<label
								className={`create-dropzone${dragOver ? " drag" : ""}${imagePreview ? " has-preview" : ""}`}
								onDragOver={(e) => {
									e.preventDefault();
									setDragOver(true);
								}}
								onDragLeave={() => setDragOver(false)}
								onDrop={onDrop}
							>
								<input
									type="file"
									accept="image/png,image/jpeg,image/webp,image/gif"
									onChange={onImageChange}
									disabled={uploading || busy}
								/>
								{imagePreview ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={imagePreview}
										alt=""
										className="create-dropzone-img"
									/>
								) : (
									<>
										<span className="create-dropzone-icon" aria-hidden />
										<strong>
											{uploading ? t("create.uploading") : "upload"}
										</strong>
										<small>PNG-JPEG-WEBP-GIF</small>
										<small>Max Size: 5MB</small>
									</>
								)}
							</label>
						</div>

						<div className="create-basic-fields">
							<label>
								<span className="create-field-label">
									{t("create.name")}
									<em>
										{name.length}/{NAME_MAX}
									</em>
								</span>
								<input
									value={name}
									onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
									maxLength={NAME_MAX}
									placeholder={t("create.placeholderName")}
									required
								/>
							</label>
							<label>
								<span className="create-field-label">
									{t("create.ticker")}
									<em>
										{shortName.length}/{TICKER_MAX}
									</em>
								</span>
								<input
									value={shortName}
									onChange={(e) =>
										setShortName(
											e.target.value.slice(0, TICKER_MAX).toUpperCase(),
										)
									}
									maxLength={TICKER_MAX}
									placeholder={t("create.placeholderTicker")}
									required
								/>
							</label>
						</div>
					</div>

					<label className="create-desc-field">
						<span className="create-field-label">
							{t("create.intro")}
							<em>
								{desc.length}/{DESC_MAX}
							</em>
						</span>
						<textarea
							value={desc}
							onChange={(e) => setDesc(e.target.value.slice(0, DESC_MAX))}
							maxLength={DESC_MAX}
							rows={4}
							placeholder={t("create.placeholderDesc")}
						/>
					</label>
				</CreateSection>

				<CreateSection step={2} title={t("create.section.details")}>
					<div className="create-quote-block">
						<span className="create-quote-label">{t("create.quote")}</span>
						<div
							className="create-quote-grid"
							role="listbox"
							aria-busy={configLoading}
						>
							{configLoading
								? Array.from({ length: 3 }, (_, index) => (
										<QuoteCardSkeleton key={index} />
									))
								: raisedList.map((item) => {
										const active = raised?.symbol === item.symbol;
										const label =
											item.nativeSymbol?.trim() || item.symbol;
										return (
											<button
												key={item.symbol}
												type="button"
												role="option"
												aria-selected={active}
												className={`create-quote-card${active ? " active" : ""}`}
												onClick={() => setRaised(item)}
											>
												<span className="create-quote-icon" aria-hidden>
													{item.logoUrl ? (
														<img src={item.logoUrl} alt="" />
													) : (
														label.slice(0, 1)
													)}
												</span>
												<span className="create-quote-meta">
													<strong>{label}</strong>
													<em>
														{Number(item.raisedAmount).toLocaleString()}{" "}
														{label}
													</em>
												</span>
											</button>
										);
									})}
						</div>
					</div>

					<div className="create-links">
						<label>
							{t("create.website")}
							<input
								value={webUrl}
								onChange={(e) => setWebUrl(e.target.value)}
								placeholder="https://"
								maxLength={200}
							/>
						</label>
						<label>
							{t("create.twitter")}
							<input
								value={twitterUrl}
								onChange={(e) => setTwitterUrl(e.target.value)}
								placeholder="https://x.com/…"
								maxLength={200}
							/>
						</label>
						<label>
							{t("create.telegram")}
							<input
								value={telegramUrl}
								onChange={(e) => setTelegramUrl(e.target.value)}
								placeholder="https://t.me/…"
								maxLength={200}
							/>
						</label>
					</div>

					<label className="create-toggle">
						<span className="create-toggle-copy">
							<strong>{t("create.antiSniper")}</strong>
							<em>{t("create.antiSniperHint")}</em>
						</span>
						<input
							type="checkbox"
							checked={feePlan}
							onChange={(e) => setFeePlan(e.target.checked)}
						/>
						<span className="create-switch" aria-hidden />
					</label>
				</CreateSection>

				{isTaxTemplate ? (
					<CreateSection step={3} title={t("create.section.tax")}>
						<CreateTaxFields
							value={taxInfo}
							onChange={setTaxInfo}
							quoteSymbol={
								raised?.nativeSymbol?.trim() || raised?.symbol
							}
						/>
					</CreateSection>
				) : null}

				<CreateSection
					step={isTaxTemplate ? 4 : 3}
					title={t("create.section.prebuy")}
				>
					<div className="create-prebuy">
						<label>
							<span className="create-field-label">
								{t("create.prebuy.amount", {
									token: prebuyPaySymbol,
								})}
								<em>{t("create.optional")}</em>
							</span>
							<div className="create-prebuy-input">
								<input
									type="number"
									min={0}
									step="any"
									value={presaleQuote}
									onChange={(e) => {
										const raw = e.target.value;
										if (raw === "") {
											setPresaleQuote("");
											return;
										}
										const n = Number(raw);
										if (!Number.isFinite(n) || n < 0) return;
										const max = Number(raised?.raisedAmount);
										if (Number.isFinite(max) && n > max) {
											setPresaleQuote(String(max));
											return;
										}
										setPresaleQuote(raw);
									}}
									placeholder="0"
								/>
								<span>{prebuyPaySymbol}</span>
							</div>
						</label>
						<p className="muted create-prebuy-balance">
							{t("trade.balance")}:{" "}
							{!address
								? "—"
								: prebuyBalPending
									? "…"
									: `${prebuyBalHuman} ${prebuyPaySymbol}`}
						</p>
						<p className="muted create-prebuy-hint">
							{t("create.prebuy.hint", {
								token: prebuyPaySymbol,
							})}
						</p>
					</div>
				</CreateSection>

				<button
					type="submit"
					className="btn create-submit"
					disabled={busy || uploading || configLoading}
				>
					<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
						<path
							d="M12 2c3.5 3 5 7.2 5 11.2 0 1.7-.4 3.2-1 4.5l3 3-1.4 1.4-3-3c-1.3.6-2.8 1-4.5 1C6.2 20 2 18.5 2 12c0-4 4-8.5 10-10Zm0 4.2A5.8 5.8 0 0 0 6.2 12c0 3.2 2.6 5.8 5.8 5.8S17.8 15.2 17.8 12 15.2 6.2 12 6.2Z"
							fill="currentColor"
						/>
					</svg>
					{busy ? t("create.submitting") : t("create.submit")}
				</button>
			</div>

			<aside className="create-aside">
				<section className="create-card create-preview-card">
					<h3>{t("create.preview")}</h3>
					<div className="create-preview-token">
						{imagePreview ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={imagePreview} alt="" />
						) : (
							<div className="create-image-placeholder sm" />
						)}
						<div>
							<strong>{previewName}</strong>
							<span>${previewTicker}</span>
						</div>
						<em>{currentChain?.label || "BNB Chain"}</em>
					</div>
					<p className="create-preview-addr">
						{address ? formatAddress(address, 4) : "0x…"}
					</p>
					<p className="create-preview-desc">
						{desc.trim() || t("create.placeholderDesc")}
					</p>
					<div className="create-preview-links">
						{webUrl ? <span>Web</span> : null}
						{twitterUrl ? <span>X</span> : null}
						{telegramUrl ? <span>TG</span> : null}
					</div>
				</section>

				<section className="create-card create-summary-card">
					<h3>{t("create.summary")}</h3>
					<dl>
						{showModePicker ? (
							<div>
								<dt>{t("create.section.mode")}</dt>
								<dd>
									{configLoading && !(String(templateId) in taxByPresetId) ? (
										<Skeleton width={72} height="0.85rem" />
									) : (
										modeLabel
									)}
								</dd>
							</div>
						) : null}
						<div>
							<dt>{t("create.quote")}</dt>
							<dd>
								{configLoading ? (
									<Skeleton width={48} height="0.85rem" />
								) : (
									raisedDisplay
								)}
							</dd>
						</div>
						<div>
							<dt>{t("create.prebuy.summary")}</dt>
							<dd>
								{presaleQuote.trim()
									? `${presaleQuote} ${prebuyPaySymbol}`
									: "—"}
							</dd>
						</div>
						{configLoading && !(String(templateId) in taxByPresetId) ? (
							<div>
								<dt>{t("create.bonding")}</dt>
								<dd>
									<Skeleton width={72} height="0.85rem" />
								</dd>
							</div>
						) : isTaxTemplate ? (
							<>
								<div>
									<dt>{t("create.tax.buyRate")}</dt>
									<dd>{taxInfo.taxFeeRateBuy}%</dd>
								</div>
								<div>
									<dt>{t("create.tax.royalty.template")}</dt>
									<dd>
										{isCustomRoyalty(taxInfo.taxVault?.typeId)
											? t("create.tax.royalty.custom")
											: t("create.tax.royalty.unverified")}
									</dd>
								</div>
								<div>
									<dt>{t("create.tax.sellRate")}</dt>
									<dd>{taxInfo.taxFeeRateSell}%</dd>
								</div>
								<div>
									<dt>{t("create.tax.recipient")}</dt>
									<dd>{taxInfo.taxTokenInfo.fundsRecipient}%</dd>
								</div>
								<div>
									<dt>{t("create.tax.holders")}</dt>
									<dd>{taxInfo.taxTokenInfo.divideToHolders}%</dd>
								</div>
								<div>
									<dt>{t("create.tax.burn")}</dt>
									<dd>{taxInfo.taxTokenInfo.burn}%</dd>
								</div>
								<div>
									<dt>{t("create.tax.liquidity")}</dt>
									<dd>{taxInfo.taxTokenInfo.addToLiquidity}%</dd>
								</div>
								{isCustomRoyalty(taxInfo.taxVault?.typeId) ? (
									<div className="create-summary-wide">
										<dt>{t("create.tax.wallet")}</dt>
										<dd>
											{taxInfo.taxWalletAddress
												? formatAddress(taxInfo.taxWalletAddress, 4)
												: "—"}
										</dd>
									</div>
								) : null}
							</>
						) : (
							<div>
								<dt>{t("create.bonding")}</dt>
								<dd>{modeLabel}</dd>
							</div>
						)}
						<div>
							<dt>{t("create.antiSniper")}</dt>
							<dd>{feePlan ? "ON" : "OFF"}</dd>
						</div>
					</dl>
				</section>
			</aside>
		</form>
	);
}
