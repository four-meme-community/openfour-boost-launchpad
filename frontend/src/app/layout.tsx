import type { Metadata } from "next";
import { headers } from "next/headers";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";
import { I18nProvider } from "@/i18n/provider";
import { fetchSiteConfig, FALLBACK_SITE_CONFIG } from "@/lib/bff";
import { isDarkThemeRoute, siteStyleVars } from "@/lib/theme";
import { getAppRoutePath } from "@/i18n/locale-path";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import "./globals.css";

const manrope = Manrope({
	subsets: ["latin"],
	weight: "variable",
	variable: "--font-manrope",
	display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	weight: "variable",
	variable: "--font-jetbrains-mono",
	display: "swap",
});

export const metadata: Metadata = {
	title: "OpenFour Boost",
	description: "White-label meme token boost",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	let config = FALLBACK_SITE_CONFIG;
	try {
		config = await fetchSiteConfig();
	} catch {
		// BFF down → fallback
	}
	const requestHeaders = await headers();
	const headerLocale = requestHeaders.get("x-locale") || "";
	const locale: Locale = isLocale(headerLocale) ? headerLocale : defaultLocale;
	const routePath = getAppRoutePath(requestHeaders.get("x-pathname") || "/");
	const usesDarkTheme = isDarkThemeRoute(routePath);

	return (
		<html
			lang={locale}
			className={[
				manrope.variable,
				jetbrainsMono.variable,
				usesDarkTheme ? "theme-detail" : "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			<body style={siteStyleVars(config)}>
				<Providers siteConfig={config}>
					<I18nProvider initialLocale={locale}>
						<AppShell siteName={config.name} tagline={config.tagline}>
							{children}
						</AppShell>
					</I18nProvider>
				</Providers>
			</body>
		</html>
	);
}
