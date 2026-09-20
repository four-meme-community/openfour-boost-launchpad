/**
 * Unverified Royalty (ForwardVault): enter template address → load moduleEncodeSchema → encode initData.
 * Mirrors meme-launcher CustomUnverifiedTaxVaultForm.
 */
"use client";

import { useEffect, useState } from "react";
import { readContract } from "wagmi/actions";
import { isAddress, type Address } from "viem";
import { Skeleton } from "@/components/skeleton";
import { useI18n } from "@/i18n/provider";
import {
	defaultFormFromSchema,
	encodeModuleParams,
	mapModuleSchema,
	type ModuleSchema,
} from "@/lib/open-four-encode";
import {
	templateSchemaAbi,
	type SchemaLoadStatus,
} from "@/lib/tax-vault";
import { getActiveChain } from "@/lib/chain";
import { wagmiConfig } from "@/lib/wagmi";

function safeEncode(
	schema: ModuleSchema,
	form: Record<string, unknown>,
): `0x${string}` | null {
	try {
		return encodeModuleParams(schema, form);
	} catch {
		return null;
	}
}

function TemplateSchemaSkeleton() {
	return (
		<div className="create-tax-skel" aria-busy="true" aria-hidden>
			<div className="create-tax-skel-field">
				<Skeleton width="48%" height="0.7rem" />
				<Skeleton width="100%" height="2.4rem" />
			</div>
			<Skeleton width="55%" height="0.85rem" />
			<div className="create-tax-skel-field">
				<Skeleton width="36%" height="0.7rem" />
				<Skeleton width="100%" height="2.4rem" />
			</div>
			<div className="create-tax-skel-field">
				<Skeleton width="42%" height="0.7rem" />
				<Skeleton width="100%" height="2.4rem" />
			</div>
		</div>
	);
}

export function CreateUnverifiedTaxVaultForm({
	schema,
	formData,
	update,
	onLoadStatusChange,
}: {
	schema: ModuleSchema;
	formData: Record<string, unknown>;
	update: (patch: Record<string, unknown>) => void;
	onLoadStatusChange: (status: SchemaLoadStatus) => void;
}) {
	const { t } = useI18n();
	const [templateSchema, setTemplateSchema] = useState<ModuleSchema | null>(
		null,
	);
	const [templateForm, setTemplateForm] = useState<Record<string, unknown>>(
		{},
	);
	const [templateDeveloper, setTemplateDeveloper] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const template = String(formData?.template || "");
	const templateParam = schema.params.find((param) => param.name === "template");

	useEffect(() => {
		setTemplateSchema(null);
		setTemplateForm({});
		setTemplateDeveloper("");
		setError("");

		if (!template) {
			onLoadStatusChange("idle");
			return;
		}
		if (!isAddress(template)) {
			setError(t("create.tax.unverified.invalidAddress"));
			onLoadStatusChange("error");
			return;
		}

		let cancelled = false;
		const timer = setTimeout(async () => {
			setLoading(true);
			onLoadStatusChange("loading");
			try {
				const [raw, developer] = await Promise.all([
					readContract(wagmiConfig, {
						address: template as Address,
						abi: templateSchemaAbi,
						functionName: "moduleEncodeSchema",
						chainId: getActiveChain().id,
					}),
					readContract(wagmiConfig, {
						address: template as Address,
						abi: templateSchemaAbi,
						functionName: "authorWallet",
						chainId: getActiveChain().id,
					}),
				]);
				if (cancelled) return;

				const nextSchema = mapModuleSchema(
					raw as Parameters<typeof mapModuleSchema>[0],
				);
				const defaults = defaultFormFromSchema(nextSchema.params);
				const initData =
					nextSchema.params.length === 0
						? ("0x" as const)
						: safeEncode(nextSchema, defaults);

				setTemplateSchema(nextSchema);
				setTemplateForm(defaults);
				setTemplateDeveloper(String(developer));
				update({ template, initData: initData ?? "0x" });
				onLoadStatusChange(initData === null ? "incomplete" : "valid");
			} catch {
				if (!cancelled) {
					setError(t("create.tax.unverified.loadFailed"));
					onLoadStatusChange("error");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}, 300);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
		// Intentionally only re-run when template address changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [template, t]);

	const handleTemplateChange = (value: string) => {
		update({ template: value.trim(), initData: "0x" });
		onLoadStatusChange(value.trim() ? "loading" : "idle");
	};

	const handleParamChange = (key: string, value: string) => {
		if (!templateSchema) return;
		const nextForm = { ...templateForm, [key]: value };
		setTemplateForm(nextForm);
		const initData = safeEncode(templateSchema, nextForm);
		update({ template, initData: initData ?? "0x" });
		onLoadStatusChange(initData === null ? "incomplete" : "valid");
	};

	const handleParamBlur = (
		key: string,
		value: string,
		minValue?: string,
		maxValue?: string,
	) => {
		let nextValue = value;
		if (minValue !== "" && minValue != null && Number(value) < Number(minValue)) {
			nextValue = minValue;
		}
		if (maxValue !== "" && maxValue != null && Number(value) > Number(maxValue)) {
			nextValue = maxValue;
		}
		if (nextValue !== value) handleParamChange(key, nextValue);
	};

	return (
		<div className="create-tax-unverified">
			<div className="create-tax-note" role="note">
				<strong>{t("create.tax.unverified.riskTitle")}</strong>
				<p>{t("create.tax.unverified.riskBody")}</p>
			</div>

			<label>
				<span className="create-field-label create-field-label-inline">
					{t("create.tax.unverified.templateAddress")}
					<span className="create-field-required" aria-hidden>
						*
					</span>
				</span>
				<input
					value={template}
					onChange={(e) => handleTemplateChange(e.target.value)}
					placeholder={templateParam?.defaultValue || "0x…"}
					maxLength={42}
					required
				/>
				<span className="muted create-tax-field-hint">
					{t("create.tax.unverified.templateHint")}
				</span>
			</label>

			{loading ? <TemplateSchemaSkeleton /> : null}
			{error ? (
				<p className="muted create-tax-hint" role="alert">
					{error}
				</p>
			) : null}

			{!loading && templateSchema ? (
				<div className="create-tax-unverified-params">
					<label>
						<span className="create-field-label">
							{t("create.tax.unverified.developer")}
						</span>
						<input value={templateDeveloper} disabled readOnly />
					</label>
					<p className="create-tax-unverified-params-title">
						{t("create.tax.unverified.initParams")}
					</p>
					{templateSchema.params.length > 0 ? (
						<div className="create-tax-schema-fields">
							{templateSchema.params.map((desc) => {
								const label = desc.title || desc.name;
								const value = templateForm[desc.name];
								const strVal = value == null ? "" : String(value);
								const isNum =
									desc.abiType === "uint8" ||
									desc.abiType === "uint16" ||
									desc.abiType === "uint256";
								const required = !desc.optional;
								return (
									<label key={desc.name}>
										<span className="create-field-label create-field-label-inline">
											{label}
											{required ? (
												<span className="create-field-required" aria-hidden>
													*
												</span>
											) : null}
										</span>
										<input
											type={isNum ? "number" : "text"}
											value={strVal}
											placeholder={desc.defaultValue || undefined}
											required={required}
											onChange={(e) =>
												handleParamChange(desc.name, e.target.value)
											}
											onBlur={(e) =>
												handleParamBlur(
													desc.name,
													e.target.value,
													desc.minValue,
													desc.maxValue,
												)
											}
										/>
										{desc.hint ? (
											<span className="muted create-tax-field-hint">
												{desc.hint}
											</span>
										) : null}
									</label>
								);
							})}
						</div>
					) : (
						<p className="muted">
							{t("create.tax.unverified.noInitParams")}
						</p>
					)}
				</div>
			) : null}
		</div>
	);
}
