import type { CSSProperties } from "react";
import type { SiteConfig } from "@/lib/bff";

/**
 * Map site branding to CSS variables for the global layout.
 * Keep visual hooks centralized — avoid hardcoded colors scattered in pages.
 */
export function siteStyleVars(config: SiteConfig): CSSProperties {
	return {
		["--color-primary" as string]: config.primaryColor,
	};
}

/**
 * Routes covered by dark + neon-green visuals (no locale/chain prefix).
 * Root layout uses this for SSR to avoid a light→dark flash on refresh;
 * AppShell reuses the same check on client navigations.
 */
export function isDarkThemeRoute(routePath: string): boolean {
	return (
		routePath === "/" ||
		routePath.startsWith("/token") ||
		routePath.startsWith("/create") ||
		routePath.startsWith("/referral") ||
		routePath.startsWith("/dividends")
	);
}
