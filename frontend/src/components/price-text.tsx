/**
 * Unit price display: $0.0₈1595 (subscript compress when leading zeros ≥4).
 * Flash blur/gradient on value change.
 */
"use client";

import { FlashValue } from "@/components/flash-value";
import { formatCompactPriceParts } from "@/lib/format";

export function PriceText({
	value,
	className = "",
	prefixDollar = true,
}: {
	value?: string | number | null;
	className?: string;
	/** When false, omit $ (e.g. unit already shown beside chart) */
	prefixDollar?: boolean;
}) {
	const parts = formatCompactPriceParts(value, 4);
	if (!parts) {
		return (
			<FlashValue value={value} className={className}>
				—
			</FlashValue>
		);
	}

	if (parts.zeros < 4) {
		const text = prefixDollar
			? parts.text
			: parts.text.replace(/^\$/, "");
		return (
			<FlashValue value={value} className={className}>
				<span title={String(value ?? "")}>{text}</span>
			</FlashValue>
		);
	}

	return (
		<FlashValue value={value} className={`price-compact ${className}`.trim()}>
			<span title={String(value ?? "")}>
				{prefixDollar ? parts.prefix : parts.prefix.replace("$", "")}
				0.0
				<sub>{parts.zeros}</sub>
				{parts.significant}
			</span>
		</FlashValue>
	);
}
