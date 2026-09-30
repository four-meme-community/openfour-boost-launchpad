"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { usePathname } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { parseChainQueryFromPath } from "@/i18n/locale-path";
import {
	translations,
	type TranslationKey,
} from "@/i18n/translations";
import {
	getMemeNetworkCodeFromQuery,
	withMemeNetworkPath,
} from "@/lib/network";

type I18nValue = {
	locale: Locale;
	setLocale: (next: Locale) => void;
	t: (key: TranslationKey, values?: Record<string, string | number>) => string;
	href: (pathname: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

const LOCALE_COOKIE = "NEXT_LOCALE";

function readLocaleCookie(): Locale | null {
	if (typeof document === "undefined") return null;
	const match = document.cookie.match(
		new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`),
	);
	const raw = match?.[1] ? decodeURIComponent(match[1]) : "";
	return isLocale(raw) ? raw : null;
}

export function I18nProvider({
	children,
	initialLocale = defaultLocale,
}: {
	children: ReactNode;
	initialLocale?: Locale;
}) {
	const pathname = usePathname();
	const [locale, setLocaleState] = useState<Locale>(initialLocale);

	useEffect(() => {
		const fromCookie = readLocaleCookie();
		if (fromCookie && fromCookie !== locale) setLocaleState(fromCookie);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- sync cookie once after mount / SSR mismatch
	}, []);

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	const networkCode = useMemo(() => {
		const fromPath = parseChainQueryFromPath(pathname);
		return getMemeNetworkCodeFromQuery(fromPath);
	}, [pathname]);

	const setLocale = useCallback((next: Locale) => {
		document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
		setLocaleState(next);
	}, []);

	const value = useMemo<I18nValue>(() => {
		const dictionary = translations[locale];
		return {
			locale,
			setLocale,
			t: (key, values) => {
				let text: string = dictionary[key] || translations.en[key] || key;
				for (const [name, replacement] of Object.entries(values || {})) {
					text = text.replaceAll(`{${name}}`, String(replacement));
				}
				return text;
			},
			href: (target) => withMemeNetworkPath(target, networkCode),
		};
	}, [locale, networkCode, setLocale]);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
	const value = useContext(I18nContext);
	if (!value) throw new Error("useI18n must be used within I18nProvider");
	return value;
}
