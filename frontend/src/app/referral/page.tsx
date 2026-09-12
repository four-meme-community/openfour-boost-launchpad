/**
 * Referral page: official Web API (same as meme-launcher).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { CopyIcon } from "@/components/copy-icon";
import { ReferralRebateCard } from "@/components/referral-rebate-card";
import { ReferralRecords } from "@/components/referral-records";
import { useAuth } from "@/hooks/auth-provider";
import { useI18n } from "@/i18n/provider";
import {
	bindInviteCode,
	fetchInviteUser,
	type InviteUserInfo,
} from "@/lib/invite-api";
import { claimRebate } from "@/lib/rebate";

export default function ReferralPage() {
	const { t } = useI18n();
	const { isAuthenticated, login } = useAuth();
	const { address } = useAccount();
	const [info, setInfo] = useState<InviteUserInfo | null>(null);
	const [code, setCode] = useState("");
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);
	const [busy, setBusy] = useState(false);
	const [origin, setOrigin] = useState("");
	const [linkCopied, setLinkCopied] = useState(false);

	useEffect(() => {
		setOrigin(window.location.origin);
	}, []);

	const reload = useCallback(async () => {
		if (!isAuthenticated) {
			setInfo(null);
			return;
		}
		const res = await fetchInviteUser();
		if (res.code !== 0) throw new Error(res.msg || "Failed to load invite");
		setInfo(res.data);
	}, [isAuthenticated]);

	useEffect(() => {
		reload().catch(() =>
			setMessage({ type: "error", text: t("error.load") }),
		);
	}, [reload, t]);

	const onBind = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage(null);
		if (!isAuthenticated) {
			try {
				await login();
			} catch {
				setMessage({ type: "error", text: t("error.signIn") });
				return;
			}
		}
		setBusy(true);
		try {
			const res = await bindInviteCode(code.trim());
			if (res.code !== 0) throw new Error("bind_failed");
			setMessage({ type: "success", text: t("referral.bound") });
			await reload();
		} catch {
			setMessage({ type: "error", text: t("error.bindInvite") });
		} finally {
			setBusy(false);
		}
	};

	const referralLink =
		origin && info?.referralCode ? `${origin}?code=${info.referralCode}` : "";

	const onCopyLink = async () => {
		if (!referralLink) return;
		try {
			await navigator.clipboard.writeText(referralLink);
			setLinkCopied(true);
			window.setTimeout(() => setLinkCopied(false), 1200);
		} catch {
			setLinkCopied(false);
		}
	};

	const onClaim = async () => {
		setMessage(null);
		if (!isAuthenticated || !address) {
			setMessage({ type: "error", text: t("referral.signIn") });
			return;
		}
		setBusy(true);
		try {
			const result = await claimRebate(address, info?.rebateRets);
			setMessage(
				result.claimed
					? { type: "success", text: t("referral.claimed", { hash: result.hash }) }
					: { type: "success", text: t("referral.nothingToClaim") },
			);
			await reload();
		} catch (e) {
			const failedWithdrawal =
				e instanceof Error && e.message === "withdrawal_failed";
			setMessage({
				type: "error",
				text: t(
					failedWithdrawal ? "referral.withdrawalFailed" : "referral.claimFailed",
				),
			});
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="referral-page">
			<div className="page-heading">
				<h1>{t("referral.title")}</h1>
				<p className="muted">{t("referral.description")}</p>
			</div>

			<div className="referral-grid">
				<div className="referral-grid-main">
					{!isAuthenticated ? (
						<div className="card referral-auth-state">
							<p className="muted">{t("referral.signIn")}</p>
						</div>
					) : (
						<div className="card referral-summary">
							<p>
								{t("referral.yourCode")}:{" "}
								<strong>{info?.referralCode || "—"}</strong>
							</p>
							<p className="muted">
								{t("referral.rate")}:{" "}
								{info?.inviteRate != null
									? `${Number(info.inviteRate) * 100}%`
									: "—"}
							</p>
							{info?.invitedAddress ? (
								<p className="muted">
									{t("referral.invitedBy")}: {info.invitedAddress}
								</p>
							) : null}
							{referralLink ? (
								<label className="referral-link-field">
									<span className="muted">{t("referral.yourLink")}</span>
									<div className="referral-link-row">
										<input
											readOnly
											value={referralLink}
											onFocus={(e) => e.currentTarget.select()}
										/>
										<button
											type="button"
											className={`btn btn-ghost referral-link-copy${
												linkCopied ? " copied" : ""
											}`}
											onClick={onCopyLink}
										>
											<CopyIcon size={13} />
											{linkCopied ? t("referral.linkCopied") : t("referral.copyLink")}
										</button>
									</div>
								</label>
							) : null}
						</div>
					)}

					<form className="form referral-bind" onSubmit={onBind}>
						<label>
							{t("referral.bindLabel")}
							<input
								value={code}
								onChange={(e) => setCode(e.target.value)}
								placeholder={t("referral.bindPlaceholder")}
							/>
						</label>
						<button
							type="submit"
							className="btn"
							disabled={busy || !code.trim()}
						>
							{t("referral.bind")}
						</button>
					</form>

					<ReferralRecords enabled={isAuthenticated} />
				</div>

				{isAuthenticated ? (
					<ReferralRebateCard info={info} busy={busy} onClaim={onClaim} />
				) : null}
			</div>

			{message ? (
				<p className={message.type === "error" ? "err" : "ok"}>
					{message.text}
				</p>
			) : null}
		</section>
	);
}
