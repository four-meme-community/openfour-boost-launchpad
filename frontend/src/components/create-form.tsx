/**
 * OpenFour create form: stepped sections + right preview/summary.
 */
"use client";

import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { CreateTaxFields } from "@/components/create-tax-fields";
import { useAuth } from "@/hooks/auth-provider";
import {
	DEFAULT_CREATE_TAX_INFO,
	validateCreateTaxInfo,
	type CreateTaxInfo,
} from "@/lib/create-tax";
import {
	createOpenFourToken,
	enrichRaisedWithLogos,
	isTaxTokenSchema,
	loadCommonConfig,
	loadContracts,
	loadSchemas,
	loadTemplateConfig,
	type TemplateSymbolConfig,
} from "@/lib/open-four";
import { publicEnv } from "@/lib/env";
import { formatAddress } from "@/lib/format";
import { imageUrl, uploadTokenImage } from "@/lib/meme-api";
import { useI18n } from "@/i18n/provider";

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

export function CreateForm() {
	const { href, t } = useI18n();
	const { address, isConnected } = useAccount();
	const { isAuthenticated, login } = useAuth();
	const router = useRouter();
	const [raisedList, setRaisedList] = useState<TemplateSymbolConfig[]>([]);
	const [raised, setRaised] = useState<TemplateSymbolConfig | null>(null);
	const [isTaxTemplate, setIsTaxTemplate] = useState(false);
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
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);
	const setErrorMessage = (text: string) =>
		setMessage({ type: "error", text });

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const [list, commonConfig, contracts] = await Promise.all([
					loadTemplateConfig(publicEnv.openFourTemplateId),
					loadCommonConfig().catch(() => []),
					loadContracts(),
				]);
				if (cancelled) return;
				const enriched = enrichRaisedWithLogos(list, commonConfig);
				setRaisedList(enriched);
				setRaised(enriched[0] || null);

				const schemas = await loadSchemas(
					contracts.OpenFourTools,
					publicEnv.openFourTemplateId,
				);
				if (cancelled) return;
				setIsTaxTemplate(isTaxTokenSchema(schemas.token.params));
			} catch {
				if (!cancelled) setErrorMessage(t("error.config"));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [t]);

	useEffect(() => {
		if (!address) return;
		setTaxInfo((prev) =>
			prev.taxWalletAddress
				? prev
				: { ...prev, taxWalletAddress: address },
		);
	}, [address]);

	const uploadFile = async (file: File) => {
		setMessage(null);
		if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
			setErrorMessage(t("error.imageType"));
			return;
		}
		if (file.size > MAX_IMAGE_BYTES) {
			setErrorMessage(t("error.imageSize"));
			return;
		}
		if (!isConnected || !address) {
			setErrorMessage(t("error.connectBeforeUpload"));
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
			setErrorMessage(t("error.imageUpload"));
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
		setMessage(null);
		if (!isConnected || !address) {
			setErrorMessage(t("error.connectWallet"));
			return;
		}
		if (!isAuthenticated) {
			try {
				await login();
			} catch {
				setErrorMessage(t("error.signIn"));
				return;
			}
		}
		if (!raised) {
			setErrorMessage(t("error.quoteConfig"));
			return;
		}
		if (!name.trim() || !shortName.trim()) {
			setErrorMessage(t("error.nameTicker"));
			return;
		}
		if (!imgUrl) {
			setErrorMessage(t("error.imageRequired"));
			return;
		}
		if (isTaxTemplate) {
			const taxErr = validateCreateTaxInfo(taxInfo);
			if (taxErr) {
				setErrorMessage(t("error.taxConfig"));
				return;
			}
		}
		const prebuyNum = Number(presaleQuote);
		if (
			presaleQuote.trim() !== "" &&
			(!Number.isFinite(prebuyNum) || prebuyNum < 0)
		) {
			setErrorMessage(t("error.invalidAmount"));
			return;
		}
		if (
			Number.isFinite(prebuyNum) &&
			prebuyNum > 0 &&
			raised.raisedAmount != null &&
			prebuyNum > Number(raised.raisedAmount)
		) {
			setErrorMessage(t("error.prebuyMax"));
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
				tax: isTaxTemplate ? taxInfo : null,
			});
			setMessage({
				type: "success",
				text: t("create.created", {
					id: result.tokenId,
					hash: result.hash,
				}),
			});
			if (result.address) {
				router.push(href(`/token/${result.address}`));
			}
		} catch {
			setErrorMessage(t("error.create"));
		} finally {
			setBusy(false);
		}
	};

	const previewName = name.trim() || t("create.placeholderName");
	const previewTicker = shortName.trim() || t("create.placeholderTicker");

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
						<div className="create-quote-grid" role="listbox">
							{raisedList.map((item) => {
								const active = raised?.symbol === item.symbol;
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
												item.symbol.slice(0, 1)
											)}
										</span>
										<span className="create-quote-meta">
											<strong>{item.symbol}</strong>
											<em>
												{Number(item.raisedAmount).toLocaleString()}{" "}
												{item.symbol}
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
							quoteSymbol={raised?.symbol}
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
									token: raised?.symbol || "BNB",
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
								<span>{raised?.symbol || "BNB"}</span>
							</div>
						</label>
						<p className="muted create-prebuy-hint">
							{t("create.prebuy.hint", {
								token: raised?.symbol || "BNB",
							})}
						</p>
					</div>
				</CreateSection>

				<button
					type="submit"
					className="btn create-submit"
					disabled={busy || uploading}
				>
					<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
						<path
							d="M12 2c3.5 3 5 7.2 5 11.2 0 1.7-.4 3.2-1 4.5l3 3-1.4 1.4-3-3c-1.3.6-2.8 1-4.5 1C6.2 20 2 18.5 2 12c0-4 4-8.5 10-10Zm0 4.2A5.8 5.8 0 0 0 6.2 12c0 3.2 2.6 5.8 5.8 5.8S17.8 15.2 17.8 12 15.2 6.2 12 6.2Z"
							fill="currentColor"
						/>
					</svg>
					{busy ? t("create.submitting") : t("create.submit")}
				</button>

				{message ? (
					<p className={message.type === "success" ? "ok" : "err"}>
						{message.text}
					</p>
				) : null}
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
						<em>BNB Chain</em>
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
						<div>
							<dt>{t("create.quote")}</dt>
							<dd>{raised?.symbol || "—"}</dd>
						</div>
						<div>
							<dt>{t("create.prebuy.summary")}</dt>
							<dd>
								{presaleQuote.trim()
									? `${presaleQuote} ${raised?.symbol || ""}`
									: "—"}
							</dd>
						</div>
						{isTaxTemplate ? (
							<>
								<div>
									<dt>{t("create.tax.buyRate")}</dt>
									<dd>{taxInfo.taxFeeRateBuy}%</dd>
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
								<div className="create-summary-wide">
									<dt>{t("create.tax.wallet")}</dt>
									<dd>
										{taxInfo.taxWalletAddress
											? formatAddress(taxInfo.taxWalletAddress, 4)
											: "—"}
									</dd>
								</div>
							</>
						) : (
							<div>
								<dt>{t("create.bonding")}</dt>
								<dd>Template {publicEnv.openFourTemplateId}</dd>
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
