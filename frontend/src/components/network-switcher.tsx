/**
 * Header chain switcher: BSC ↔ Robinhood (testnet when not PROD).
 * Connected wallets are asked to switch first; reject leaves the app chain unchanged.
 */
"use client";

import { Suspense, useId, useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/toast";
import { useSiteConfig } from "@/hooks/site-config";
import { getWagmiChain } from "@/lib/chain";
import {
	goHomeAndReload,
	MEME_NETWORK_ID,
	MEME_NETWORK_QUERY,
	setClientMemeNetworkCode,
	type MemeNetworkId,
} from "@/lib/network";
import { switchWalletToChain } from "@/lib/switch-wallet-chain";
import { useI18n } from "@/i18n/provider";

function BnbIcon({ size = 14 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
			<title>BNB Chain</title>
			<path
				d="M6.00392 3.6761L12.3727 0L18.7415 3.6761L16.4 5.03415L12.3727 2.7161L8.34539 5.03415L6.00392 3.6761ZM18.7415 8.31219L16.4 6.95415L12.3727 9.2722L8.34539 6.95415L6.00392 8.31219V11.0283L10.0312 13.3463V17.9824L12.3727 19.3405L14.7142 17.9824V13.3463L18.7415 11.0283V8.31219ZM18.7415 15.6644V12.9483L16.4 14.3063V17.0224L18.7415 15.6644ZM20.4039 16.6244L16.3766 18.9424V21.6585L22.7454 17.9824V10.6302L20.4039 11.9883V16.6244ZM18.0625 5.99415L20.4039 7.35219V10.0683L22.7454 8.71024V5.99415L20.4039 4.6361L18.0625 5.99415ZM10.0312 19.9259V22.642L12.3727 24L14.7142 22.642V19.9259L12.3727 21.2839L10.0312 19.9259ZM6.00392 15.6644L8.34539 17.0224V14.3063L6.00392 12.9483V15.6644ZM10.0312 5.99415L12.3727 7.35219L14.7142 5.99415L12.3727 4.6361L10.0312 5.99415ZM4.34146 7.35219L6.68293 5.99415L4.34146 4.6361L2 5.99415V8.71024L4.34146 10.0683V7.35219ZM4.34146 11.9883L2 10.6302V17.9824L8.36877 21.6585V18.9424L4.34146 16.6244V11.9883Z"
				fill="#F0B90B"
			/>
		</svg>
	);
}

function RobinhoodIcon({ size = 14 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
			<title>Robinhood Chain</title>
			<path d="M12 1.8L21.2 7.1V16.9L12 22.2L2.8 16.9V7.1L12 1.8Z" fill="#CCFF00" />
			<path d="M12 5.4L17.4 8.5V14.7L12 17.8L6.6 14.7V8.5L12 5.4Z" fill="#0A0A0A" />
			<path d="M12 8.2L14.8 9.8V13.1L12 14.7L9.2 13.1V9.8L12 8.2Z" fill="#CCFF00" />
		</svg>
	);
}

function NetworkIcon({
	networkId,
	size = 14,
}: {
	networkId: MemeNetworkId;
	size?: number;
}) {
	if (networkId === MEME_NETWORK_ID.ROBINHOOD) {
		return <RobinhoodIcon size={size} />;
	}
	return <BnbIcon size={size} />;
}

function shortNetworkLabel(label: string, max = 4) {
	const first = label.trim().split(/\s+/)[0] || label.trim();
	if (first.length <= max) return first;
	return first.slice(0, max);
}

function NetworkSwitcherContent() {
	const { t } = useI18n();
	const toast = useToast();
	const { chains, defaultChain } = useSiteConfig();
	const searchParams = useSearchParams();
	const [open, setOpen] = useState(false);
	const [switchingCode, setSwitchingCode] = useState("");
	const rootRef = useRef<HTMLDivElement>(null);
	const menuId = useId();
	const query = searchParams.get(MEME_NETWORK_QUERY);
	const current = useMemo(() => {
		const fromQuery = chains.find(
			(item) =>
				item.query === query || item.id === query || item.key === query,
		);
		return (
			fromQuery ||
			chains.find((item) => item.key === defaultChain) ||
			chains[0]
		);
	}, [chains, defaultChain, query]);

	useEffect(() => {
		if (!open) return;
		const onDoc = (event: MouseEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDoc);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	if (!current || chains.length < 2) return null;

	const onSelect = async (code: string, chainId: number) => {
		setOpen(false);
		if (code === current.code || switchingCode) return;
		setSwitchingCode(code);
		try {
			await switchWalletToChain(getWagmiChain(chainId).id);
			setClientMemeNetworkCode(code);
			goHomeAndReload(code);
		} catch (error) {
			setSwitchingCode("");
			const message = String(
				(error as { shortMessage?: string; message?: string })?.shortMessage ||
					(error as Error)?.message ||
					"",
			);
			const rejected =
				(error as { code?: number })?.code === 4001 ||
				/user rejected|user denied|rejected the request/i.test(message);
			toast.error(
				rejected ? t("network.switchRejected") : t("network.switchFailed"),
			);
		}
	};

	return (
		<div
			ref={rootRef}
			className={`language-switcher network-switcher${open ? " open" : ""}`}
		>
			<button
				type="button"
				className="language-switcher-trigger"
				aria-label={`${t("network.label")}: ${current.label}`}
				aria-expanded={open}
				aria-controls={menuId}
				disabled={Boolean(switchingCode)}
				onClick={() => setOpen((value) => !value)}
			>
				<NetworkIcon networkId={current.id} />
				<span>{shortNetworkLabel(current.label)}</span>
				<svg width="10" height="6" viewBox="0 0 10 6" aria-hidden>
					<path
						d="M1 1l4 4 4-4"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>
			<div id={menuId} className="language-switcher-menu" hidden={!open}>
				{chains.map((item) => {
					const active = item.code === current.code && item.key === current.key;
					const pending = switchingCode === item.code;
					return (
						<button
							key={item.key}
							type="button"
							className={`language-switcher-option${active ? " active" : ""}`}
							disabled={Boolean(switchingCode)}
							onClick={() => void onSelect(item.code, item.chainId)}
						>
							<span className="language-switcher-check" aria-hidden>
								<NetworkIcon networkId={item.id} size={14} />
							</span>
							{pending ? `${item.label}…` : item.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function NetworkSwitcherFallback() {
	const { chains, defaultChain } = useSiteConfig();
	const current =
		chains.find((item) => item.key === defaultChain) || chains[0];
	const { t } = useI18n();
	if (!current || chains.length < 2) return null;
	return (
		<div className="language-switcher network-switcher">
			<button
				type="button"
				className="language-switcher-trigger"
				aria-label={`${t("network.label")}: ${current.label}`}
				disabled
			>
				<NetworkIcon networkId={current.id} />
				<span>{shortNetworkLabel(current.label)}</span>
			</button>
		</div>
	);
}

export function NetworkSwitcher() {
	return (
		<Suspense fallback={<NetworkSwitcherFallback />}>
			<NetworkSwitcherContent />
		</Suspense>
	);
}
