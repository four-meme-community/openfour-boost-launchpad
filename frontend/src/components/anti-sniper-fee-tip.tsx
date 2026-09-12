/**
 * Anti-sniper decaying fee tip (aligned with meme-launcher AntiSniperFeeTip).
 */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/provider";

const ROWS = [
	["1", "50%", "0.75s"],
	["2", "25%", "1.5s"],
	["3", "15%", "2.25s"],
	["4", "10%", "3s"],
	["5", "5%", "3.75s"],
] as const;

function FeePlanIcon({ className = "" }: { className?: string }) {
	return (
		<svg
			width="12"
			height="14"
			viewBox="0 0 12 14"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden
		>
			<path
				d="M10.8493 1.1133L10.8178 1.10208L6.1503 0.0168317C6.10424 0.00561058 6.05899 0.000801511 6.01293 0H5.98626C5.9402 0 5.89495 0.00641209 5.84889 0.0168317L1.18222 1.10208L1.15071 1.1133C0.462222 1.35135 0 2.04466 0 2.83976V8.14977C0 9.08273 0.326465 9.97962 0.970505 10.814C1.45939 11.4464 2.13333 12.0443 2.97212 12.5893C3.70101 13.0622 4.42909 13.4109 4.9099 13.6193C5.12889 13.7147 5.34384 13.8012 5.54909 13.8774C5.80929 13.9744 5.87879 13.9992 6.00646 13.9992C6.10586 13.9992 6.20202 13.976 6.28768 13.9351C6.62545 13.8165 7.8198 13.3716 9.02788 12.5869C9.86747 12.0419 10.5398 11.4456 11.0295 10.8116C11.6735 9.97721 12 9.08193 12 8.14736V2.83976C12 2.04466 11.5378 1.35135 10.8493 1.1133ZM10.7055 8.14977C10.7055 9.34883 9.9103 10.4758 8.34101 11.5001C7.38586 12.1229 6.41535 12.518 6.00081 12.6727C5.5903 12.5196 4.63434 12.1309 3.68242 11.5145C2.59313 10.8084 1.29616 9.6518 1.29616 8.15057V2.83976C1.29616 2.58327 1.42707 2.39171 1.55636 2.3324L6.00081 1.29925L10.4453 2.3324C10.5762 2.39171 10.7055 2.58167 10.7055 2.83976V8.14977Z"
				fill="currentColor"
			/>
			<path
				d="M8.8242 6.13612H6.55839L7.00448 3.07521C7.00968 3.03881 6.98161 3.00529 6.94209 3.0005C6.91714 2.99763 6.89114 3.00721 6.87554 3.0254L3.03646 7.60337C2.97719 7.67424 2.99175 7.77576 3.0687 7.83035C3.09989 7.85238 3.13733 7.86388 3.1758 7.86388H5.44161L4.99552 10.9248C4.99032 10.9612 5.01839 10.9947 5.05791 10.9995C5.08286 11.0024 5.10886 10.9928 5.12446 10.9746L8.96354 6.39663C9.02281 6.32575 9.00825 6.22424 8.9313 6.16964C8.90011 6.14762 8.86267 6.13612 8.8242 6.13612Z"
				fill="currentColor"
			/>
		</svg>
	);
}

export function AntiSniperFeeTip() {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const tipId = useId();

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDoc);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<div
			ref={rootRef}
			className={`anti-sniper-tip${open ? " open" : ""}`}
		>
			<button
				type="button"
				className="anti-sniper-tip-trigger"
				aria-label={t("token.antiSniperRule")}
				aria-expanded={open}
				aria-controls={tipId}
				onClick={() => setOpen((v) => !v)}
				onMouseEnter={() => {
					if (window.matchMedia("(hover: hover)").matches) setOpen(true);
				}}
				onMouseLeave={() => {
					if (window.matchMedia("(hover: hover)").matches) setOpen(false);
				}}
			>
				<FeePlanIcon />
			</button>
			<div id={tipId} role="tooltip" className="anti-sniper-tip-panel" hidden={!open}>
				<div className="anti-sniper-tip-title">
					{t("token.antiSniperRule")}
				</div>
				<div className="anti-sniper-tip-grid">
					<span className="muted">{t("token.block")}</span>
					<span className="muted right">{t("token.fee")}</span>
					<span className="muted right">{t("token.approxTime")}</span>
					<div className="contents">
						<span>0 ({t("token.creation")})</span>
						<span className="right tabular">100%</span>
						<span className="right tabular">0s</span>
					</div>
					{ROWS.map((row) => (
						<div key={row[0]} className="contents">
							<span>{row[0]}</span>
							<span className="right tabular">{row[1]}</span>
							<span className="right tabular">{row[2]}</span>
						</div>
					))}
					<div className="contents">
						<span>6+</span>
						<span className="right tabular">
							({t("token.normalRate")}) 1%
						</span>
						<span className="right tabular">4.5s+</span>
					</div>
				</div>
			</div>
		</div>
	);
}
