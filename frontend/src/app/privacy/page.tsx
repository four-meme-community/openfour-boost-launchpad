/**
 * Privacy Policy — condensed original copy; site name from config.
 */
"use client";

import { useSiteConfig } from "@/hooks/site-config";
import { useI18n } from "@/i18n/provider";

const SECTIONS = [
	{ title: "legal.privacy.aboutTitle", body: "legal.privacy.aboutBody" },
	{ title: "legal.privacy.collectTitle", body: "legal.privacy.collectBody" },
	{ title: "legal.privacy.useTitle", body: "legal.privacy.useBody" },
	{ title: "legal.privacy.chainTitle", body: "legal.privacy.chainBody" },
	{ title: "legal.privacy.thirdTitle", body: "legal.privacy.thirdBody" },
	{ title: "legal.privacy.rightsTitle", body: "legal.privacy.rightsBody" },
	{ title: "legal.privacy.contactTitle", body: "legal.privacy.contactBody" },
] as const;

export default function PrivacyPage() {
	const { t } = useI18n();
	const { name } = useSiteConfig();
	const values = { siteName: name };

	return (
		<article className="legal-page">
			<h1>{t("footer.privacy")}</h1>
			<p className="muted legal-page-meta">{t("legal.privacy.intro", values)}</p>
			{SECTIONS.map((section) => (
				<section key={section.title} className="legal-page-section">
					<h2>{t(section.title)}</h2>
					<p>{t(section.body, values)}</p>
				</section>
			))}
		</article>
	);
}
