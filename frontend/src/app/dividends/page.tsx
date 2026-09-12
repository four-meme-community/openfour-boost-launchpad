/**
 * My tax dividends: cross-token holdings + claimable overview with batch claim.
 * Core logic in `components/dividends-panel.tsx` (also embedded in
 * `/token/[address]/tax` side panel — shared, no extra navigation).
 */
"use client";

import { DividendsPanel } from "@/components/dividends-panel";
import { useI18n } from "@/i18n/provider";

export default function DividendsPage() {
	const { t } = useI18n();

	return (
		<section className="dividends-page">
			<div className="page-heading">
				<h1>{t("dividends.title")}</h1>
				<p className="muted">{t("dividends.description")}</p>
			</div>
			<DividendsPanel />
		</section>
	);
}
