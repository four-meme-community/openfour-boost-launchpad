/**
 * Trade settings: slippage, gas price, max gas (localStorage).
 */
export type GasMode = "MARKET" | "FAST" | "TURBO" | "CUSTOM";

export type TradeSettings = {
	slippage: number;
	gasMode: GasMode;
	/** Gwei in CUSTOM mode */
	gasGwei: string;
	/**
	 * Max gas limit; empty string = auto (estimate × 1.2).
	 * Numeric string, e.g. "500000".
	 */
	maxGas: string;
};

const STORAGE_KEY = "openfour-trade-settings";

export const DEFAULT_TRADE_SETTINGS: TradeSettings = {
	slippage: 1,
	gasMode: "MARKET",
	gasGwei: "3",
	maxGas: "",
};

export function loadTradeSettings(): TradeSettings {
	if (typeof window === "undefined") return { ...DEFAULT_TRADE_SETTINGS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_TRADE_SETTINGS };
		const parsed = JSON.parse(raw) as Partial<TradeSettings>;
		return {
			...DEFAULT_TRADE_SETTINGS,
			...parsed,
			slippage: Number(parsed.slippage) || DEFAULT_TRADE_SETTINGS.slippage,
		};
	} catch {
		return { ...DEFAULT_TRADE_SETTINGS };
	}
}

export function saveTradeSettings(next: TradeSettings) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function gasModeMultiplier(mode: GasMode): number {
	switch (mode) {
		case "FAST":
			return 3;
		case "TURBO":
			return 10;
		default:
			return 1;
	}
}
