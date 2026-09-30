/**
 * Header chain switcher: BSC ↔ Robinhood (testnet when not PROD).
 * Connected wallets are asked to switch first; reject leaves the app chain unchanged.
 */
"use client";

import { useId, useMemo, useRef, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/toast";
import { useSiteConfig } from "@/hooks/site-config";
import { parseChainQueryFromPath } from "@/i18n/locale-path";
import { getWagmiChain } from "@/lib/chain";
import {
	goHomeAndReload,
	MEME_NETWORK_ID,
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

function RobinhoodIcon({ size = 16 }: { size?: number }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			fill="none"
			viewBox="0 0 16 16"
			aria-hidden
		>
			<title>Robinhood</title>
			<path
				fill="#cf0"
				d="M9.6097 3.882c.0998.0004.1302.0606.06.1407-1.7055 1.8861-4.4248 5.0361-6.923 11.3967-.02.05-.0805.0806-.1405.0806H2.275c-.0701-.0001-.1006-.0434-.0806-.1216.331-1.2238.7834-2.5785 1.4957-4.5748V8.035c0-.5316.0803-.9025.4013-1.3037l2.1871-2.7086c.0773-.0963.1709-.1406.2813-.1406z"
			/>
			<path
				fill="#cf0"
				d="M10.2103 4.6468c.0701-.0801.1404-.04.1406.06v3.8336c0 .0501-.0095.1202-.0395.1802l-1.3946 2.2969c-.1704.2807-.3694.4234-.7222.5317l-3.1304.9639c-.0903.0301-.1392-.0371-.101-.1113 1.5148-2.9595 3.1504-5.4175 5.2471-7.755"
			/>
			<path
				fill="#cf0"
				d="M9.699.7634c.9836-.381 3.1103-.361 3.5817.1406.5314.562.6008 1.9167.4805 2.7994-.0903.6016-.1906.7319-.5215 1.163l-2.0362 2.6588c-.0601.0902-.1405.0606-.1406-.0395v-3.813c-.0002-.3109-.1813-.4908-.4922-.4908h-3.381c-.0997-.0003-.1297-.0707-.06-.1407.5718-.6019 1.1743-1.2139 2.0772-1.9863.0903-.0773.2875-.2123.4922-.2915"
			/>
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

function shortNetworkLabel(label: string) {
	return label.trim().split(/\s+/)[0] || label.trim();
}

export function NetworkSwitcher() {
	const { t } = useI18n();
	const toast = useToast();
	const { chains, defaultChain } = useSiteConfig();
	const pathname = usePathname();
	const [open, setOpen] = useState(false);
	const [switchingCode, setSwitchingCode] = useState("");
	const rootRef = useRef<HTMLDivElement>(null);
	const menuId = useId();
	const pathQuery = parseChainQueryFromPath(pathname);
	const current = useMemo(() => {
		const fromPath = pathQuery
			? chains.find(
					(item) =>
						item.query === pathQuery ||
						item.id === pathQuery ||
						item.key === pathQuery,
				)
			: null;
		return (
			fromPath ||
			chains.find((item) => item.key === defaultChain) ||
			chains[0]
		);
	}, [chains, defaultChain, pathQuery]);

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
				<span className="network-label-full">
					{shortNetworkLabel(current.label)}
				</span>
				<span className="network-label-short">
					{current.id === MEME_NETWORK_ID.ROBINHOOD ? "RH" : "BSC"}
				</span>
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
