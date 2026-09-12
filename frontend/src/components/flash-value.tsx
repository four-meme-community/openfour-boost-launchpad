/**
 * On value change, blur + gradient highlight flash.
 */
"use client";

import {
	type CSSProperties,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

function toNum(v: unknown): number | null {
	if (v == null || v === "") return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

export function FlashValue({
	value,
	className = "",
	style,
	children,
	as: Tag = "span",
}: {
	/** Raw value used to detect changes */
	value: string | number | null | undefined;
	className?: string;
	style?: CSSProperties;
	children: ReactNode;
	as?: "span" | "strong" | "div";
}) {
	const prevRef = useRef<string | number | null | undefined>(value);
	const primed = useRef(false);
	const [flash, setFlash] = useState<"up" | "down" | null>(null);
	const [tick, setTick] = useState(0);

	useEffect(() => {
		const prev = prevRef.current;
		const next = value;
		prevRef.current = next;

		if (!primed.current) {
			primed.current = true;
			return;
		}

		const a = String(prev ?? "");
		const b = String(next ?? "");
		if (a === b) return;

		const na = toNum(prev);
		const nb = toNum(next);
		const dir: "up" | "down" =
			na != null && nb != null ? (nb >= na ? "up" : "down") : "up";
		setFlash(dir);
		setTick((t) => t + 1);
	}, [value]);

	const flashClass =
		flash === "up"
			? "num-flash num-flash--up"
			: flash === "down"
				? "num-flash num-flash--down"
				: "";

	return (
		<Tag
			key={tick}
			className={`${className} ${flashClass}`.trim()}
			style={style}
			onAnimationEnd={() => setFlash(null)}
		>
			{children}
		</Tag>
	);
}
