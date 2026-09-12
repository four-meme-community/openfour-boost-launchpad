/**
 * meme-web optional media URLs: ^https?:\/\/.{1,150}$
 * Incomplete placeholders like `https://` must be omitted, not sent.
 */
const MEME_WEB_OPTIONAL_URL_RE = /^https?:\/\/.{1,150}$/;

/** Return trimmed URL if valid for create API; otherwise undefined (omit field). */
export function normalizeOptionalCreateUrl(
	value?: string | null,
): string | undefined {
	const trimmed = String(value ?? "").trim();
	if (!trimmed) return undefined;
	if (!MEME_WEB_OPTIONAL_URL_RE.test(trimmed)) return undefined;
	return trimmed;
}

/** True when the field is empty/placeholder, or a complete http(s) URL. */
export function isOptionalCreateUrlInputOk(value?: string | null): boolean {
	const trimmed = String(value ?? "").trim();
	if (!trimmed) return true;
	return MEME_WEB_OPTIONAL_URL_RE.test(trimmed);
}
