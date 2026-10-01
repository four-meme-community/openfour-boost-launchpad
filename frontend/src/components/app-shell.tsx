/**
 * App shell: brand header + nav + wallet.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useI18n } from "@/i18n/provider";
import { getAppRoutePath } from "@/i18n/locale-path";
import { isDarkThemeRoute } from "@/lib/theme";
import { LanguageSwitcher } from "./language-switcher";
import { NetworkSwitcher } from "./network-switcher";
import { TokenSearch } from "./token-search";
import { WalletButton } from "./wallet-button";

export function AppShell({
	siteName,
	tagline,
	children,
}: {
	siteName: string;
	tagline: string;
	children: ReactNode;
}) {
	const pathname = usePathname();
	const routePath = getAppRoutePath(pathname);
	const { href, t } = useI18n();
	const usesDarkTheme = isDarkThemeRoute(routePath);
	const nav = [
		{ href: "/", label: t("nav.market") },
		{ href: "/create", label: t("nav.create") },
		{ href: "/referral", label: t("nav.referral") },
		{ href: "/dividends", label: t("nav.dividends") },
	];

	useEffect(() => {
		document.documentElement.classList.toggle("theme-detail", usesDarkTheme);
		return () => {
			document.documentElement.classList.remove("theme-detail");
		};
	}, [usesDarkTheme]);

	return (
		<>
			<header className="site-header">
				<div className="header-row">
					<div className="brand">
						<Link href={href("/")} className="brand-name">
							{siteName}
						</Link>
						<p className="brand-tagline">{tagline}</p>
					</div>
					<div className="header-actions">
						<NetworkSwitcher />
						<LanguageSwitcher />
						<WalletButton />
					</div>
				</div>
				<div className="header-search">
					<TokenSearch />
				</div>
				<nav className="nav">
					{nav.map((item) => (
						<Link
							key={item.href}
							href={href(item.href)}
							className={
								routePath === item.href ? "nav-link active" : "nav-link"
							}
						>
							{item.label}
						</Link>
					))}
				</nav>
			</header>
			<main className="site-main">{children}</main>
		</>
	);
}
