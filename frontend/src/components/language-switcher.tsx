"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";
import { localizePath } from "@/i18n/locale-path";
import { useI18n } from "@/i18n/provider";

export function LanguageSwitcher() {
	const pathname = usePathname();
	const router = useRouter();
	const { locale, t } = useI18n();
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const menuId = useId();

	useEffect(() => {
		if (!open) return;
		const onDoc = (event: MouseEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDoc);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const selectLocale = (next: Locale) => {
		setOpen(false);
		if (next === locale) return;
		document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;samesite=lax`;
		router.push(localizePath(pathname, next));
	};

	return (
		<div
			ref={rootRef}
			className={`language-switcher${open ? " open" : ""}`}
		>
			<button
				type="button"
				className="language-switcher-trigger"
				aria-label={t("language.label")}
				aria-expanded={open}
				aria-controls={menuId}
				onClick={() => setOpen((value) => !value)}
			>
				<span>{t(`language.${locale}`)}</span>
				<svg width="10" height="6" viewBox="0 0 10 6" aria-hidden>
					<path
						d="M1 1l4 4 4-4"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>
			<div id={menuId} className="language-switcher-menu" hidden={!open}>
				{locales.map((item) => {
					const active = item === locale;
					return (
						<button
							key={item}
							type="button"
							className={`language-switcher-option${active ? " active" : ""}`}
							onClick={() => selectLocale(item)}
						>
							<span className="language-switcher-check" aria-hidden>
								{active ? (
									<svg width="12" height="10" viewBox="0 0 12 10">
										<path
											d="M1 5l3.2 3.2L11 1.5"
											fill="none"
											stroke="currentColor"
											strokeWidth="1.8"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								) : null}
							</span>
							{t(`language.${item}`)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
