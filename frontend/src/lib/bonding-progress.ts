/** Bonding / raise fill ratio from ticker `progress` (0–1 or 0–100). */
export function bondingProgressPct(
	progress?: string | number | null,
): number {
	const n = Number(progress ?? 0);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return n <= 1 ? n * 100 : n;
}

/**
 * Target raise in quote units.
 * Prefer explicit config; else infer from raised / progress when both known.
 */
export function resolveTargetRaiseAmount(params: {
	raisedAmount?: string | number | null;
	raisedQuote?: string | number | null;
	progress?: string | number | null;
}): string | null {
	const configured = Number(params.raisedAmount);
	if (Number.isFinite(configured) && configured > 0) {
		return String(params.raisedAmount);
	}
	const raised = Number(params.raisedQuote);
	const pct = bondingProgressPct(params.progress);
	if (Number.isFinite(raised) && raised > 0 && pct > 0) {
		return String(raised / (pct / 100));
	}
	return null;
}
