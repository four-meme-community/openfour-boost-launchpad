/**
 * BFF fill SSE client (browser does not connect to meme-web WS).
 * Upstream channel: `{tokenId}@FILL_EVENT@0`
 */
import { publicEnv } from "./env";
import type { TokenFill } from "./meme-api";

export type FillStreamPush = TokenFill & {
	channel?: string;
};

export type FillStreamHandlers = {
	onFill?: (fill: FillStreamPush) => void;
	onReady?: (info: unknown) => void;
	onError?: (err: Event) => void;
};

export function subscribeFillStream(
	params: { tokenId: number },
	handlers: FillStreamHandlers,
): () => void {
	const qs = new URLSearchParams({ tokenId: String(params.tokenId) });
	const url = `${publicEnv.bffUrl}/v1/stream/fills?${qs}`;
	const es = new EventSource(url, { withCredentials: true });

	es.addEventListener("ready", (ev) => {
		try {
			handlers.onReady?.(JSON.parse((ev as MessageEvent).data));
		} catch {
			handlers.onReady?.(null);
		}
	});

	es.addEventListener("fill", (ev) => {
		try {
			const fill = JSON.parse((ev as MessageEvent).data) as FillStreamPush;
			handlers.onFill?.(fill);
		} catch {
			// ignore
		}
	});

	es.onerror = (err) => {
		handlers.onError?.(err);
	};

	return () => {
		es.close();
	};
}
