/**
 * Lightweight toast for wallet interaction feedback.
 */
"use client";

import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from "react";

export type ToastKind = "success" | "error" | "info";

type ToastItem = {
	id: number;
	kind: ToastKind;
	message: string;
};

type ToastApi = {
	toast: (message: string, kind?: ToastKind) => void;
	success: (message: string) => void;
	error: (message: string) => void;
	info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<ToastItem[]>([]);

	const push = useCallback((message: string, kind: ToastKind = "info") => {
		const text = String(message || "").trim();
		if (!text) return;
		const id = ++seq;
		setItems((prev) => [...prev.slice(-4), { id, kind, message: text }]);
		window.setTimeout(() => {
			setItems((prev) => prev.filter((t) => t.id !== id));
		}, 3200);
	}, []);

	const api = useMemo<ToastApi>(
		() => ({
			toast: push,
			success: (m) => push(m, "success"),
			error: (m) => push(m, "error"),
			info: (m) => push(m, "info"),
		}),
		[push],
	);

	return (
		<ToastContext.Provider value={api}>
			{children}
			<div className="toast-host" aria-live="polite">
				{items.map((item) => (
					<div
						key={item.id}
						className={`toast toast--${item.kind}`}
						role="status"
					>
						{item.message}
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast(): ToastApi {
	const ctx = useContext(ToastContext);
	if (!ctx) {
		return {
			toast: () => {},
			success: () => {},
			error: () => {},
			info: () => {},
		};
	}
	return ctx;
}
