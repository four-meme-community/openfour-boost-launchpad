/**
 * Simple EIP-6963 wallet picker (no WalletConnect / no projectId).
 */
"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useConnect, useConnectors, type Connector } from "wagmi";
import { useToast } from "@/components/toast";
import { useI18n } from "@/i18n/provider";
import { getActiveChain } from "@/lib/chain";

function isEip6963(connector: Connector): boolean {
	const rdns = connector.rdns;
	if (rdns) return Array.isArray(rdns) ? rdns.length > 0 : true;
	// MIPD wallets use rdns as connector.id (e.g. io.metamask); generic fallback is "injected".
	return connector.id !== "injected";
}

/**
 * Prefer EIP-6963 announced wallets.
 * Hide the generic `injected` entry when any announced wallet exists — it usually
 * points at the same default provider (e.g. OKX) and looks like a duplicate.
 */
export function pickWalletConnectors(connectors: readonly Connector[]): Connector[] {
	const announced = connectors.filter(isEip6963);
	if (announced.length > 0) return announced;
	return connectors.filter((c) => c.id === "injected");
}

function WalletIcon({
	connector,
	size = 36,
}: {
	connector: Connector;
	size?: number;
}) {
	const [broken, setBroken] = useState(false);
	const icon = connector.icon;
	if (!icon || broken) {
		const letter = (connector.name || "?").trim().charAt(0).toUpperCase() || "?";
		return (
			<span
				className="wallet-modal__icon-fallback"
				style={{ width: size, height: size, fontSize: size * 0.4 }}
				aria-hidden
			>
				{letter}
			</span>
		);
	}
	return (
		// EIP-6963 icons are data: URLs from the extension — safe as img src.
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={icon}
			alt=""
			width={size}
			height={size}
			className="wallet-modal__icon"
			onError={() => setBroken(true)}
		/>
	);
}

export function WalletConnectModal({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const toast = useToast();
	const connectors = useConnectors();
	const { connectAsync, isPending } = useConnect();
	const [pendingId, setPendingId] = useState<string | null>(null);
	const titleId = useId();

	const wallets = useMemo(
		() => pickWalletConnectors(connectors),
		[connectors],
	);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
		};
	}, [open, onClose]);

	if (!open) return null;

	const onPick = async (connector: Connector) => {
		if (isPending || pendingId) return;
		setPendingId(connector.uid);
		try {
			await connectAsync({
				connector,
				chainId: getActiveChain().id,
			});
			onClose();
		} catch (error) {
			const message = String(
				(error as { shortMessage?: string; message?: string })?.shortMessage ||
					(error as Error)?.message ||
					"",
			);
			const rejected =
				(error as { code?: number })?.code === 4001 ||
				/user rejected|user denied|rejected the request/i.test(message);
			if (!rejected) toast.error(t("error.walletConnect"));
		} finally {
			setPendingId(null);
		}
	};

	return (
		<div className="wallet-modal" role="presentation">
			<button
				type="button"
				className="wallet-modal__backdrop"
				aria-label={t("wallet.close")}
				onClick={onClose}
			/>
			<div
				className="wallet-modal__panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
			>
				<div className="wallet-modal__head">
					<h2 id={titleId} className="wallet-modal__title">
						{t("wallet.connectTitle")}
					</h2>
					<button
						type="button"
						className="wallet-modal__close"
						aria-label={t("wallet.close")}
						onClick={onClose}
					>
						×
					</button>
				</div>
				<p className="wallet-modal__hint">{t("wallet.connectHint")}</p>
				{wallets.length === 0 ? (
					<p className="wallet-modal__empty">{t("error.walletUnavailable")}</p>
				) : (
					<ul className="wallet-modal__list">
						{wallets.map((connector) => {
							const busy = pendingId === connector.uid;
							return (
								<li key={connector.uid}>
									<button
										type="button"
										className="wallet-modal__item"
										disabled={Boolean(pendingId) || isPending}
										onClick={() => void onPick(connector)}
									>
										<WalletIcon connector={connector} />
										<span className="wallet-modal__name">
											{connector.name}
										</span>
										{busy ? (
											<span className="wallet-modal__pending">
												{t("wallet.connecting")}
											</span>
										) : null}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
