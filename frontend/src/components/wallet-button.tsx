/**
 * Wallet connect + meme-web login.
 */
"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useToast } from "@/components/toast";
import { UserMenu } from "@/components/user-menu";
import { useAuth } from "@/hooks/auth-provider";
import { getActiveChain } from "@/lib/chain";
import { formatAddress } from "@/lib/format";
import { useI18n } from "@/i18n/provider";

export function WalletButton() {
	const { t } = useI18n();
	const { address, isConnected } = useAccount();
	const { connectors, connectAsync, isPending } = useConnect();
	const { disconnect } = useDisconnect();
	const { status, login, logout, isAuthenticated } = useAuth();
	const toast = useToast();
	const [busy, setBusy] = useState(false);

	const onConnect = async () => {
		setBusy(true);
		try {
			const injected = connectors.find((c) => c.id === "injected") || connectors[0];
			if (!injected) throw new Error("wallet_unavailable");
			await connectAsync({ connector: injected, chainId: getActiveChain().id });
		} catch {
			toast.error(t("error.walletConnect"));
		} finally {
			setBusy(false);
		}
	};

	const onLogin = async () => {
		setBusy(true);
		try {
			await login();
			toast.success(t("wallet.signedIn"));
		} catch {
			toast.error(t("error.signIn"));
		} finally {
			setBusy(false);
		}
	};

	const onLogout = async () => {
		await logout();
		disconnect();
		toast.info(t("wallet.signedOut"));
	};

	if (!isConnected) {
		return (
			<div className="wallet-box">
				<button type="button" className="btn" disabled={busy || isPending} onClick={onConnect}>
					{busy || isPending ? t("wallet.connecting") : t("wallet.connect")}
				</button>
			</div>
		);
	}

	return (
		<div className="wallet-box">
			{isAuthenticated ? (
				<UserMenu onLogout={onLogout} />
			) : (
				<>
					<span className="addr">{formatAddress(address)}</span>
					<button
						type="button"
						className="btn"
						disabled={busy || status === "authenticating" || status === "checking"}
						onClick={onLogin}
					>
						{status === "authenticating" || busy
							? t("wallet.signing")
							: t("wallet.signIn")}
					</button>
				</>
			)}
		</div>
	);
}
