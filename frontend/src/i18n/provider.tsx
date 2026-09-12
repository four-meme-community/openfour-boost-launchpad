"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	Suspense,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getLocaleFromPath, localizePath } from "@/i18n/locale-path";
import {
	translations,
	type TranslationKey,
} from "@/i18n/translations";
import {
	getMemeNetworkCodeFromQuery,
	MEME_NETWORK_QUERY,
	withMemeNetworkQuery,
} from "@/lib/network";

type I18nValue = {
	locale: Locale;
	t: (key: TranslationKey, values?: Record<string, string | number>) => string;
	href: (pathname: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function I18nProviderInner({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const locale = getLocaleFromPath(pathname);
	const networkCode = getMemeNetworkCodeFromQuery(
		searchParams.get(MEME_NETWORK_QUERY),
	);

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	const value = useMemo<I18nValue>(() => {
		const dictionary = translations[locale];
		return {
			locale,
			t: (key, values) => {
				let text: string = dictionary[key] || translations.en[key] || key;
				for (const [name, replacement] of Object.entries(values || {})) {
					text = text.replaceAll(`{${name}}`, String(replacement));
				}
				return text;
			},
			href: (target) =>
				withMemeNetworkQuery(localizePath(target, locale), networkCode),
		};
	}, [locale, networkCode]);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function I18nProvider({ children }: { children: ReactNode }) {
	return (
		<Suspense>
			<I18nProviderInner>{children}</I18nProviderInner>
		</Suspense>
	);
}

export function useI18n(): I18nValue {
	const value = useContext(I18nContext);
	if (!value) throw new Error("useI18n must be used within I18nProvider");
	return value;
}
