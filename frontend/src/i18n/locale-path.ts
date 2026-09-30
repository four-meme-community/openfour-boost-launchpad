import {
	defaultLocale,
	isLocale,
	locales,
	type Locale,
} from "@/i18n/config";

/** Known chain `query` values that may appear as the first path segment. */
const CHAIN_PATH_QUERIES = new Set(["bsc", "robinhood"]);

export function isChainPathQuery(value: string): boolean {
	return CHAIN_PATH_QUERIES.has(value.trim().toLowerCase());
}

export function getLocaleFromPath(pathname: string): Locale {
	const segment = pathname.split("/")[1] || "";
	return isLocale(segment) ? segment : defaultLocale;
}

/** Strip legacy `/en` (or other locale) prefix if present. */
export function stripLocalePrefix(pathname: string): string {
	for (const locale of locales) {
		if (pathname === `/${locale}`) return "/";
		if (pathname.startsWith(`/${locale}/`)) {
			return pathname.slice(locale.length + 1) || "/";
		}
	}
	return pathname || "/";
}

/** Strip `/robinhood` or `/bsc` chain prefix if present. */
export function stripChainPrefix(pathname: string): string {
	const segments = pathname.split("/").filter(Boolean);
	if (segments[0] && isChainPathQuery(segments[0])) {
		const rest = segments.slice(1);
		return rest.length === 0 ? "/" : `/${rest.join("/")}`;
	}
	return pathname || "/";
}

/**
 * App route without locale or chain prefix.
 * e.g. `/en/robinhood/token/0x` or `/bsc/token/0x` → `/token/0x`
 */
export function getAppRoutePath(pathname: string): string {
	return stripChainPrefix(stripLocalePrefix(pathname));
}

/** @deprecated Locale no longer lives in the path (cookie only). */
export function localizePath(pathname: string, _locale: Locale): string {
	if (!pathname.startsWith("/")) return pathname;
	if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
		return pathname;
	}
	return getAppRoutePath(pathname);
}

export function parseChainQueryFromPath(pathname: string): string | null {
	const withoutLocale = stripLocalePrefix(pathname);
	const segment = withoutLocale.split("/").filter(Boolean)[0] || "";
	if (segment && isChainPathQuery(segment)) return segment.toLowerCase();
	return null;
}
