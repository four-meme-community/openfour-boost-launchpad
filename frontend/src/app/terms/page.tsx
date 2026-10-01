/**
 * Terms of Use — condensed original copy; site name from config.
 */
"use client";

import { useSiteConfig } from "@/hooks/site-config";
import { useI18n } from "@/i18n/provider";

const SECTIONS = [
	{ title: "legal.terms.agreeTitle", body: "legal.terms.agreeBody" },
	{ title: "legal.terms.serviceTitle", body: "legal.terms.serviceBody" },
	{ title: "legal.terms.walletTitle", body: "legal.terms.walletBody" },
	{ title: "legal.terms.txTitle", body: "legal.terms.txBody" },
	{ title: "legal.terms.contentTitle", body: "legal.terms.contentBody" },
	{ title: "legal.terms.riskTitle", body: "legal.terms.riskBody" },
	{ title: "legal.terms.useTitle", body: "legal.terms.useBody" },
	{ title: "legal.terms.noAdviceTitle", body: "legal.terms.noAdviceBody" },
	{ title: "legal.terms.contactTitle", body: "legal.terms.contactBody" },
] as const;

export default function TermsPage() {
	const { t } = useI18n();
	const { name } = useSiteConfig();
	const values = { siteName: name };

	return (
		<article className="legal-page">
			<h1>{t("footer.terms")}</h1>
			<p className="muted legal-page-meta">{t("legal.terms.intro", values)}</p>
			{SECTIONS.map((section) => (
				<section key={section.title} className="legal-page-section">
					<h2>{t(section.title)}</h2>
					<p>{t(section.body, values)}</p>
				</section>
			))}
		</article>
	);
}
