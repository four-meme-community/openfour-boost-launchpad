export function formatAddress(address?: string | null, n = 4) {
	if (!address) return "—";
	return `${address.slice(0, n + 2)}…${address.slice(-n)}`;
}

export function formatNum(value?: string | number | null, digits = 4) {
	if (value == null || value === "") return "—";
	const n = Number(value);
	if (!Number.isFinite(n)) return String(value);
	if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
	return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

function toSubscript(n: number): string {
	return String(Math.floor(Math.abs(n)))
		.split("")
		.map((d) => SUBSCRIPT_DIGITS[Number(d)] ?? d)
		.join("");
}

/** Normalize any number to a plain decimal string (avoid 6.67e-7) */
function toPlainDecimal(value: string | number): string | null {
	const raw = String(value).trim();
	if (!raw) return null;
	if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;

	const n = Number(raw);
	if (!Number.isFinite(n) || n === 0) return null;

	const abs = Math.abs(n);
	const digits = Math.min(18, Math.max(8, Math.ceil(-Math.log10(abs)) + 6));
	return n.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

export type CompactPriceParts = {
	prefix: string;
	/** Subscript zero count; 0 means no compression */
	zeros: number;
	significant: string;
	/** Plain text: $0.0₄190 */
	text: string;
};

/**
 * Tiny unit price: $0.0₄190 (compress when leading zeros ≥4).
 * e.g. 0.0000006672 → $0.0₆6672
 */
export function formatCompactPriceParts(
	value?: string | number | null,
	significantDigits = 4,
): CompactPriceParts | null {
	if (value == null || value === "") return null;
	const plain = toPlainDecimal(value);
	if (!plain) return null;

	const neg = plain.startsWith("-");
	const abs = neg ? plain.slice(1) : plain;
	const n = Number(abs);
	if (!Number.isFinite(n)) return null;
	if (n === 0) {
		return { prefix: "", zeros: 0, significant: "0", text: "$0" };
	}

	const prefix = `${neg ? "-" : ""}$`;
	if (n >= 1) {
		const text = `${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
		return { prefix, zeros: 0, significant: text.slice(prefix.length), text };
	}

	const frac = abs.includes(".") ? abs.split(".")[1] : "";
	let zeros = 0;
	while (zeros < frac.length && frac[zeros] === "0") zeros++;
	if (zeros >= frac.length) {
		return { prefix, zeros: 0, significant: "0", text: `${prefix}0` };
	}

	const sigRaw = frac.slice(zeros, zeros + significantDigits).replace(/0+$/, "") || "0";

	if (zeros >= 4) {
		const text = `${prefix}0.0${toSubscript(zeros)}${sigRaw}`;
		return { prefix, zeros, significant: sigRaw, text };
	}

	const significant = `${abs.split(".")[0]}.${frac.slice(0, zeros)}${sigRaw}`;
	return {
		prefix,
		zeros: 0,
		significant,
		text: `${prefix}${significant}`,
	};
}

/** Text unit price (sidebar title / plain-string contexts) */
export function formatCompactPrice(
	value?: string | number | null,
	significantDigits = 4,
): string {
	return formatCompactPriceParts(value, significantDigits)?.text ?? "—";
}

/** Meme price precision: avoid formatNum truncating 1e-7 to 0; tiny prices use compressed form */
export function formatPrice(value?: string | number | null, maxDigits = 18) {
	const compact = formatCompactPriceParts(value, 4);
	if (compact && compact.zeros >= 4) return compact.text.replace(/^\$/, "");

	if (value == null || value === "") return "—";
	const raw = String(value).trim();
	if (!raw) return "—";
	const n = Number(raw);
	if (!Number.isFinite(n)) return raw;
	if (n === 0) return "0";

	const abs = Math.abs(n);
	if (abs >= 1) {
		return n.toLocaleString(undefined, {
			maximumFractionDigits: Math.min(6, maxDigits),
		});
	}

	if (/^-?\d*\.\d+$/.test(raw)) {
		const trimmed = raw.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.$/, "");
		const frac = trimmed.split(".")[1] || "";
		if (frac.length <= maxDigits) return trimmed;
		return `${trimmed.split(".")[0]}.${frac.slice(0, maxDigits)}`;
	}

	const digits = Math.min(
		maxDigits,
		Math.max(8, Math.ceil(-Math.log10(abs)) + 4),
	);
	return n
		.toFixed(digits)
		.replace(/(\.\d*?[1-9])0+$/, "$1")
		.replace(/\.$/, "");
}

/** Lightweight Charts: derive precision / minMove from min price */
export function priceFormatFromValues(values: number[]) {
	const positives = values.filter((v) => Number.isFinite(v) && v > 0);
	if (!positives.length) {
		return { type: "price" as const, precision: 8, minMove: 1e-8 };
	}
	const min = Math.min(...positives);
	const leadingZeros = Math.max(0, Math.ceil(-Math.log10(min)) - 1);
	const precision = Math.min(18, Math.max(6, leadingZeros + 4));
	const minMove = Number(`1e-${precision}`);
	return { type: "price" as const, precision, minMove };
}

/** $3.39K / 1.2M style */
export function formatCompact(
	value?: string | number | null,
	digits = 2,
): string {
	if (value == null || value === "") return "—";
	const n = Number(value);
	if (!Number.isFinite(n)) return String(value);
	const abs = Math.abs(n);
	const sign = n < 0 ? "-" : "";
	if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(digits)}B`;
	if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(digits)}M`;
	if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(digits)}K`;
	if (abs >= 1) return `${sign}${abs.toFixed(digits)}`;
	if (abs === 0) return "0";
	return formatPrice(n);
}

/** Age since create: 6d / 3h / 12m */
export function formatAge(createDate?: string | number | null): string {
	const n = Number(createDate);
	if (!Number.isFinite(n) || n <= 0) return "—";
	const ms = n > 1e12 ? n : n * 1000;
	const diff = Date.now() - ms;
	if (!Number.isFinite(diff) || diff < 0) return "—";
	const mins = Math.floor(diff / 60_000);
	if (mins < 60) return `${Math.max(mins, 0)}m`;
	const hours = Math.floor(mins / 60);
	if (hours < 48) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 60) return `${days}d`;
	const months = Math.floor(days / 30);
	return `${months}mo`;
}

export function formatPct(value?: string | number | null, digits = 2): string {
	if (value == null || value === "") return "—";
	const n = Number(value);
	if (!Number.isFinite(n)) return String(value);
	// Upstream may be 0.01=1% or already a percent
	const pct = Math.abs(n) <= 1 ? n * 100 : n;
	const sign = pct > 0 ? "+" : "";
	return `${sign}${pct.toFixed(digits)}%`;
}

export function formatSupply(value?: string | number | null): string {
	if (value == null || value === "") return "—";
	const n = Number(value);
	if (!Number.isFinite(n)) return String(value);
	if (n >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 2)}B`;
	if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2)}M`;
	if (n >= 1e3) return `${(n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 2)}K`;
	return String(n);
}
