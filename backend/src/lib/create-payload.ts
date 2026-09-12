/**
 * meme-web rejects empty/invalid optional URL fields
 * (regex ^https?:\/\/.{1,150}$). Omit them from the create payload.
 */
const CREATE_TOKEN_PATH =
	"/meme-api/v1/private/token_template/token/create";

const OPTIONAL_CREATE_MEDIA_KEYS = [
	"webUrl",
	"twitterUrl",
	"telegramUrl",
	"discord",
] as const;

/** Same rule as meme-web create validation. */
const MEME_WEB_OPTIONAL_URL_RE = /^https?:\/\/.{1,150}$/;

export function isTokenCreatePath(path: string): boolean {
	const normalized = path.replace(/\/+$/, "") || path;
	return normalized === CREATE_TOKEN_PATH;
}

function isBlank(value: unknown): boolean {
	if (value == null) return true;
	if (typeof value === "string") return value.trim() === "";
	return false;
}

/** Empty or incomplete placeholder like `https://` → drop. */
export function isValidOptionalCreateUrl(value: unknown): boolean {
	if (typeof value !== "string") return false;
	const trimmed = value.trim();
	if (!trimmed) return false;
	return MEME_WEB_OPTIONAL_URL_RE.test(trimmed);
}

export function omitEmptyCreateMediaFields(
	payload: Record<string, unknown>,
): Record<string, unknown> {
	const next = { ...payload };
	for (const key of OPTIONAL_CREATE_MEDIA_KEYS) {
		if (!(key in next)) continue;
		const value = next[key];
		if (isBlank(value) || !isValidOptionalCreateUrl(value)) {
			delete next[key];
		} else if (typeof value === "string") {
			next[key] = value.trim();
		}
	}
	return next;
}

export function rewriteCreateTokenBody(
	path: string,
	raw: ArrayBuffer | null,
): ArrayBuffer | string | null {
	if (!raw || !isTokenCreatePath(path)) return raw;

	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder().decode(raw));
	} catch {
		return raw;
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return raw;
	}

	const original = parsed as Record<string, unknown>;
	const next = omitEmptyCreateMediaFields(original);
	const omitted = OPTIONAL_CREATE_MEDIA_KEYS.some(
		(key) => key in original && !(key in next),
	);
	return omitted ? JSON.stringify(next) : raw;
}

function hexByteLen(value: unknown): number {
	if (typeof value !== "string" || !value.startsWith("0x")) return 0;
	return Math.max(0, Math.floor((value.length - 2) / 2));
}

/** Compact create-body summary for upstream 4xx/5xx logs. */
export function summarizeCreateTokenBody(
	raw: ArrayBuffer | string | null,
): Record<string, unknown> | null {
	if (!raw) return null;
	try {
		const text =
			typeof raw === "string" ? raw : new TextDecoder().decode(raw);
		const parsed = JSON.parse(text) as Record<string, unknown>;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return null;
		}
		const init =
			parsed.initParams &&
			typeof parsed.initParams === "object" &&
			!Array.isArray(parsed.initParams)
				? (parsed.initParams as Record<string, unknown>)
				: {};
		return {
			templateId: parsed.templateId,
			name: parsed.name,
			shortName: parsed.shortName,
			symbol: parsed.symbol,
			raisedAmount: parsed.raisedAmount,
			raisedAmountType: typeof parsed.raisedAmount,
			saleAmount: parsed.saleAmount,
			totalSupply: parsed.totalSupply,
			presaleQuote: parsed.presaleQuote,
			feePlan: parsed.feePlan,
			keys: Object.keys(parsed),
			initParamBytes: {
				token: hexByteLen(init.tokenParams),
				vault: hexByteLen(init.vaultParams),
				curve: hexByteLen(init.curveParams),
				trade: hexByteLen(init.tradeParams),
				migrate: hexByteLen(init.migrateParams),
				custom: hexByteLen(init.customDataParams),
			},
		};
	} catch {
		return null;
	}
}
