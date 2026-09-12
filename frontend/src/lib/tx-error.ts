/**
 * Collapse verbose viem / wagmi errors into short messages.
 */
export function txErrorMessage(error: unknown, fallback = "Transaction failed"): string {
	if (error == null) return fallback;

	const anyErr = error as {
		shortMessage?: string;
		details?: string;
		message?: string;
		cause?: unknown;
		name?: string;
	};

	const blob = [
		anyErr.shortMessage,
		anyErr.details,
		anyErr.message,
		typeof anyErr.cause === "object" && anyErr.cause
			? String((anyErr.cause as { message?: string }).message || "")
			: "",
	]
		.filter(Boolean)
		.join(" | ");

	const lower = blob.toLowerCase();

	if (
		lower.includes("user rejected") ||
		lower.includes("user denied") ||
		lower.includes("rejected the request") ||
		lower.includes("denied transaction signature")
	) {
		return "Signature cancelled";
	}
	if (lower.includes("insufficient funds")) {
		return "Insufficient balance for tx and gas";
	}
	if (
		lower.includes("insufficient allowance") ||
		lower.includes("transfer amount exceeds allowance")
	) {
		return "Allowance too low — approve again";
	}
	if (
		lower.includes("slippage") ||
		lower.includes("insufficient_output") ||
		lower.includes("excessive_input") ||
		lower.includes("too little received")
	) {
		return "Slippage too high or price moved — increase slippage and retry";
	}
	if (lower.includes("nonce too low")) {
		return "Nonce conflict — try again shortly";
	}
	if (
		lower.includes("network") ||
		lower.includes("rpc") ||
		lower.includes("fetch failed") ||
		lower.includes("timeout")
	) {
		return "Network error — try again shortly";
	}
	if (lower.includes("chain mismatch") || lower.includes("wrong chain")) {
		return "Switch to the correct network";
	}

	if (anyErr.shortMessage && anyErr.shortMessage.length < 120) {
		return anyErr.shortMessage;
	}
	if (anyErr.details && anyErr.details.length < 120) {
		return anyErr.details;
	}

	const firstLine = String(anyErr.message || "")
		.split("\n")
		.map((s) => s.trim())
		.find(Boolean);
	if (firstLine && firstLine.length < 120) return firstLine;

	return fallback;
}
