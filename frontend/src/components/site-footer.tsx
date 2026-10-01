/**
 * Site footer: centered Privacy / Terms + risk notice.
 */
"use client";

import Link from "next/link";
import { useSiteConfig } from "@/hooks/site-config";
import { useI18n } from "@/i18n/provider";

export function SiteFooter() {
	const { t, href } = useI18n();
	const { name } = useSiteConfig();

	return (
		<footer className="site-footer">
			<div className="site-footer-rule" aria-hidden />
			<div className="site-footer-inner">
				<nav className="site-footer-links" aria-label={t("footer.legal")}>
					<Link href={href("/privacy")}>{t("footer.privacy")}</Link>
					<span className="site-footer-dot" aria-hidden>
						/
					</span>
					<Link href={href("/terms")}>{t("footer.terms")}</Link>
				</nav>
				<p className="site-footer-risk">
					<span className="site-footer-risk-label">
						{t("footer.riskTitle")}:
					</span>{" "}
					{t("footer.riskBody", { siteName: name })}
				</p>
			</div>
		</footer>
	);
}
