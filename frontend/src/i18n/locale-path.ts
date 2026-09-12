import {
	defaultLocale,
	isLocale,
	locales,
	type Locale,
} from "@/i18n/config";

export function getLocaleFromPath(pathname: string): Locale {
	const segment = pathname.split("/")[1] || "";
	return isLocale(segment) ? segment : defaultLocale;
}

export function stripLocalePrefix(pathname: string): string {
	for (const locale of locales) {
		if (pathname === `/${locale}`) return "/";
		if (pathname.startsWith(`/${locale}/`)) {
			return pathname.slice(locale.length + 1) || "/";
		}
	}
	return pathname || "/";
}

export function localizePath(pathname: string, locale: Locale): string {
	if (!pathname.startsWith("/")) return pathname;
	if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
		return pathname;
	}
	const plain = stripLocalePrefix(pathname);
	return plain === "/" ? `/${locale}` : `/${locale}${plain}`;
}
