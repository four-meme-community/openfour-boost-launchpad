/**
 * Logged-in user popover: avatar / name / address / Referral / logout.
 * UX mirrors language-switcher.tsx (click open, outside/Esc close).
 */
"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/hooks/auth-provider";
import { useI18n } from "@/i18n/provider";
import { CopyIcon } from "@/components/copy-icon";
import { formatAddress } from "@/lib/format";
import { imageUrl } from "@/lib/meme-api";

export function UserMenu({ onLogout }: { onLogout: () => void }) {
	const { href, t } = useI18n();
	const { user } = useAuth();
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const menuId = useId();

	const address = typeof user?.address === "string" ? user.address : "";
	const userName =
		typeof user?.userName === "string" && user.userName.trim()
			? user.userName
			: formatAddress(address);
	const avatarPath =
		typeof user?.avatarPath === "string" ? user.avatarPath : null;

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

	const copyAddress = async () => {
		if (!address) return;
		try {
			await navigator.clipboard.writeText(address);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1200);
		} catch {
			setCopied(false);
		}
	};

	return (
		<div ref={rootRef} className={`user-menu${open ? " open" : ""}`}>
			<button
				type="button"
				className="user-menu-trigger"
				aria-expanded={open}
				aria-controls={menuId}
				onClick={() => setOpen((value) => !value)}
			>
				{avatarPath ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={imageUrl(avatarPath)} alt="" className="user-menu-avatar" />
				) : (
					<span className="user-menu-avatar user-menu-avatar--fallback" aria-hidden>
						{userName.slice(0, 1).toUpperCase()}
					</span>
				)}
				<span className="user-menu-name">{userName}</span>
			</button>

			<div id={menuId} className="user-menu-panel" hidden={!open}>
				<div className="user-menu-identity">
					{avatarPath ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={imageUrl(avatarPath)}
							alt=""
							className="user-menu-avatar lg"
						/>
					) : (
						<span
							className="user-menu-avatar lg user-menu-avatar--fallback"
							aria-hidden
						>
							{userName.slice(0, 1).toUpperCase()}
						</span>
					)}
					<div className="user-menu-identity-text">
						<strong>{userName}</strong>
						<button
							type="button"
							className={`user-menu-addr${copied ? " copied" : ""}`}
							onClick={copyAddress}
							title={address}
							aria-label={t("wallet.copyAddress")}
						>
							{formatAddress(address)}
							<CopyIcon size={11} />
						</button>
					</div>
				</div>

				<Link
					href={href("/referral")}
					className="user-menu-item"
					onClick={() => setOpen(false)}
				>
					{t("wallet.profile")}
				</Link>
				<button
					type="button"
					className="user-menu-item user-menu-item--danger"
					onClick={() => {
						setOpen(false);
						onLogout();
					}}
				>
					{t("wallet.logout")}
				</button>
			</div>
		</div>
	);
}
