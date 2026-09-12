/**
 * BFF candle SSE client (browser does not connect to meme-web WS).
 */
import { publicEnv } from "./env";
import type { BarTypeEnum } from "./meme-api";
import { getClientMemeNetworkCode } from "./network";

export type BarStreamPush = {
	tokenId: number;
	typeEnum: BarTypeEnum;
	channel: string;
	open: string;
	high: string;
	low: string;
	close: string;
	volume: string;
	amount?: string;
	createDate: string;
	category?: number;
};

export type BarStreamHandlers = {
	onBar?: (bar: BarStreamPush) => void;
	onReady?: (info: unknown) => void;
	onError?: (err: Event) => void;
};

export function subscribeBarStream(
	params: { tokenId: number; typeEnum: BarTypeEnum },
	handlers: BarStreamHandlers,
): () => void {
	const qs = new URLSearchParams({
		tokenId: String(params.tokenId),
		typeEnum: params.typeEnum,
		networkCode: getClientMemeNetworkCode(),
	});
	const url = `${publicEnv.bffUrl}/v1/stream/bars?${qs}`;
	const es = new EventSource(url, { withCredentials: true });

	es.addEventListener("ready", (ev) => {
		try {
			handlers.onReady?.(JSON.parse((ev as MessageEvent).data));
		} catch {
			handlers.onReady?.(null);
		}
	});

	es.addEventListener("bar", (ev) => {
		try {
			const bar = JSON.parse((ev as MessageEvent).data) as BarStreamPush;
			handlers.onBar?.(bar);
		} catch {
			// ignore malformed
		}
	});

	es.onerror = (err) => {
		handlers.onError?.(err);
	};

	return () => {
		es.close();
	};
}
