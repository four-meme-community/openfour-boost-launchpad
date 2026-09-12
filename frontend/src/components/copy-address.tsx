/**
 * Address + copy icon: same click-to-copy UX as `.token-addr` in `token-header.tsx`,
 * extracted for reuse (tax recipient, creator address, etc.).
 */
"use client";

import { useState } from "react";
import { CopyIcon } from "@/components/copy-icon";

export function CopyAddress({
	value,
	display,
	className = "token-addr",
}: {
	value: string;
	/** Display text; default shows value as-is; pass formatAddress() to truncate */
	display?: string;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);

	const onClick = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1200);
		} catch {
			setCopied(false);
		}
	};

	return (
		<button
			type="button"
			className={`${className}${copied ? " copied" : ""}`}
			onClick={onClick}
			title={value}
		>
			{display ?? value}
			<CopyIcon />
		</button>
	);
}
