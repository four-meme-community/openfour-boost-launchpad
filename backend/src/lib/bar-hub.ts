/**
 * meme-web upstream WS hub (shared connection for BAR candles + FILL trades).
 *
 * - Process singleton: one upstream WebSocket for the whole site
 * - Per-channel refcount: one SUBSCRIBE for many clients on the same channel
 * - Unsubscribe when idle; disconnect upstream after idle timeout
 */
import zlib from "node:zlib";
import { env } from "../config/env.js";
import { normalizeMemeNetworkCode } from "./meme-network.js";

export type BarTypeEnum =
	| "MIN1"
	| "MIN5"
	| "MIN15"
	| "HOUR1"
	| "HOUR4"
	| "DAY1";

export type BarPush = {
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

export type FillPush = {
	tokenId: number;
	channel: string;
	txHash: string;
	side: string;
	userAddress: string;
	userName?: string;
	avatarPath?: string;
	amount: string;
	volume: string;
	price: string;
	createDate: string;
	symbol?: string;
};

export type BarListener = (bar: BarPush) => void;
export type FillListener = (fill: FillPush) => void;

const IDLE_CLOSE_MS = 60_000;
const HEARTBEAT_MS = 30_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

function barChannel(
	tokenId: number,
	typeEnum: BarTypeEnum,
	networkCode: string,
): string {
	return `${tokenId}@BAR_EVENT-${typeEnum}@${networkCode}`;
}

function fillChannel(tokenId: number, networkCode: string): string {
	return `${tokenId}@FILL_EVENT@${networkCode}`;
}

function parseBarChannel(channel: string): {
	tokenId: number;
	typeEnum: BarTypeEnum;
} | null {
	const m = /^(\d+)@BAR_EVENT-([A-Z0-9]+)@\d+$/.exec(channel);
	if (!m) return null;
	return { tokenId: Number(m[1]), typeEnum: m[2] as BarTypeEnum };
}

function parseFillChannel(channel: string): { tokenId: number } | null {
	const m = /^(\d+)@FILL_EVENT@\d+$/.exec(channel);
	if (!m) return null;
	return { tokenId: Number(m[1]) };
}

async function decodeWsData(data: unknown): Promise<string> {
	if (typeof data === "string") return data;
	let buf: Buffer;
	if (Buffer.isBuffer(data)) {
		buf = data;
	} else if (data instanceof ArrayBuffer) {
		buf = Buffer.from(data);
	} else if (ArrayBuffer.isView(data)) {
		buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
	} else if (typeof Blob !== "undefined" && data instanceof Blob) {
		buf = Buffer.from(await data.arrayBuffer());
	} else {
		return String(data);
	}

	for (const decode of [
		() => zlib.inflateSync(buf),
		() => zlib.gunzipSync(buf),
		() => zlib.inflateRawSync(buf),
	]) {
		try {
			return decode().toString("utf8");
		} catch {
			// try next
		}
	}
	return buf.toString("utf8");
}

type ChannelState<T> = {
	listeners: Set<T>;
};

class MemeWsHub {
	private socket: WebSocket | null = null;
	private connecting = false;
	private barChannels = new Map<string, ChannelState<BarListener>>();
	private fillChannels = new Map<string, ChannelState<FillListener>>();
	private heartbeat: ReturnType<typeof setInterval> | null = null;
	private idleTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempt = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private intentionallyClosed = false;

	subscribeBar(
		tokenId: number,
		typeEnum: BarTypeEnum,
		listener: BarListener,
		networkCode?: string | number | null,
	): () => void {
		const suffix = normalizeMemeNetworkCode(networkCode);
		return this.subscribeTyped(
			this.barChannels,
			barChannel(tokenId, typeEnum, suffix),
			listener,
		);
	}

	/** Legacy alias */
	subscribe(
		tokenId: number,
		typeEnum: BarTypeEnum,
		listener: BarListener,
	): () => void {
		return this.subscribeBar(tokenId, typeEnum, listener);
	}

	subscribeFill(
		tokenId: number,
		listener: FillListener,
		networkCode?: string | number | null,
	): () => void {
		const suffix = normalizeMemeNetworkCode(networkCode);
		return this.subscribeTyped(
			this.fillChannels,
			fillChannel(tokenId, suffix),
			listener,
		);
	}

	stats() {
		return {
			upstream: this.socket?.readyState ?? -1,
			bars: [...this.barChannels.entries()].map(([channel, state]) => ({
				channel,
				listeners: state.listeners.size,
			})),
			fills: [...this.fillChannels.entries()].map(([channel, state]) => ({
				channel,
				listeners: state.listeners.size,
			})),
		};
	}

	private channelCount() {
		return this.barChannels.size + this.fillChannels.size;
	}

	private subscribeTyped<T>(
		map: Map<string, ChannelState<T>>,
		channel: string,
		listener: T,
	): () => void {
		let state = map.get(channel);
		const first = !state;
		if (!state) {
			state = { listeners: new Set() };
			map.set(channel, state);
		}
		state.listeners.add(listener);
		this.clearIdleTimer();

		if (first) {
			this.ensureConnected();
			this.sendUpstream({ method: "SUBSCRIBE", params: channel });
		} else {
			this.ensureConnected();
		}

		return () => {
			const cur = map.get(channel);
			if (!cur) return;
			cur.listeners.delete(listener);
			if (cur.listeners.size > 0) return;

			map.delete(channel);
			this.sendUpstream({ method: "UNSUBSCRIBE", params: channel });
			if (this.channelCount() === 0) this.scheduleIdleClose();
		};
	}

	private ensureConnected() {
		if (this.socket?.readyState === WebSocket.OPEN || this.connecting) return;
		this.connect();
	}

	private connect() {
		if (this.connecting) return;
		this.intentionallyClosed = false;
		this.connecting = true;
		this.clearReconnectTimer();

		const ws = new WebSocket(env.MEME_WS_URL);
		this.socket = ws;

		ws.addEventListener("open", () => {
			this.connecting = false;
			this.reconnectAttempt = 0;
			this.startHeartbeat();
			for (const channel of this.barChannels.keys()) {
				this.sendUpstream({ method: "SUBSCRIBE", params: channel });
			}
			for (const channel of this.fillChannels.keys()) {
				this.sendUpstream({ method: "SUBSCRIBE", params: channel });
			}
			console.log(
				JSON.stringify({
					level: "info",
					msg: "meme-ws-open",
					url: env.MEME_WS_URL,
					bars: this.barChannels.size,
					fills: this.fillChannels.size,
				}),
			);
		});

		ws.addEventListener("message", (ev) => {
			void this.onMessage(ev.data);
		});

		ws.addEventListener("error", () => {
			this.connecting = false;
		});

		ws.addEventListener("close", () => {
			this.connecting = false;
			this.stopHeartbeat();
			this.socket = null;
			if (!this.intentionallyClosed && this.channelCount() > 0) {
				this.scheduleReconnect();
			}
		});
	}

	private async onMessage(data: unknown) {
		let text: string;
		try {
			text = await decodeWsData(data);
		} catch {
			return;
		}

		let payload: {
			event?: string;
			data?: Record<string, unknown>;
		};
		try {
			payload = JSON.parse(text) as typeof payload;
		} catch {
			return;
		}

		if (!payload.event || !payload.data) return;
		if (payload.event === "pong" || payload.event === "ping") return;

		const fillParsed = parseFillChannel(payload.event);
		if (fillParsed) {
			this.dispatchFill(payload.event, fillParsed.tokenId, payload.data);
			return;
		}

		const barParsed = parseBarChannel(payload.event);
		if (barParsed) {
			this.dispatchBar(payload.event, barParsed, payload.data);
		}
	}

	private dispatchBar(
		channel: string,
		parsed: { tokenId: number; typeEnum: BarTypeEnum },
		d: Record<string, unknown>,
	) {
		const state = this.barChannels.get(channel);
		if (!state) return;

		const typeEnum = String(d.type || parsed.typeEnum) as BarTypeEnum;
		if (typeEnum !== parsed.typeEnum) return;

		const bar: BarPush = {
			tokenId: parsed.tokenId,
			typeEnum,
			channel,
			open: String(d.open ?? ""),
			high: String(d.high ?? ""),
			low: String(d.low ?? ""),
			close: String(d.close ?? ""),
			volume: String(d.volume ?? d.amount ?? "0"),
			amount: d.amount != null ? String(d.amount) : undefined,
			createDate: String(d.createDate ?? ""),
			category: d.category != null ? Number(d.category) : undefined,
		};

		for (const listener of [...state.listeners]) {
			try {
				listener(bar);
			} catch (err) {
				console.error(
					JSON.stringify({
						level: "error",
						msg: "bar-listener-error",
						error: err instanceof Error ? err.message : String(err),
					}),
				);
			}
		}
	}

	private dispatchFill(
		channel: string,
		tokenId: number,
		d: Record<string, unknown>,
	) {
		const state = this.fillChannels.get(channel);
		if (!state) return;

		const fill: FillPush = {
			tokenId: Number(d.tokenId ?? tokenId),
			channel,
			txHash: String(d.txHash ?? ""),
			side: String(d.side ?? ""),
			userAddress: String(d.userAddress ?? ""),
			userName: d.userName != null ? String(d.userName) : undefined,
			avatarPath: d.avatarPath != null ? String(d.avatarPath) : undefined,
			amount: String(d.amount ?? "0"),
			volume: String(d.volume ?? "0"),
			price: String(d.price ?? "0"),
			createDate: String(d.createDate ?? ""),
			symbol: d.symbol != null ? String(d.symbol) : undefined,
		};

		for (const listener of [...state.listeners]) {
			try {
				listener(fill);
			} catch (err) {
				console.error(
					JSON.stringify({
						level: "error",
						msg: "fill-listener-error",
						error: err instanceof Error ? err.message : String(err),
					}),
				);
			}
		}
	}

	private sendUpstream(msg: Record<string, unknown>) {
		if (this.socket?.readyState !== WebSocket.OPEN) return;
		this.socket.send(JSON.stringify(msg));
	}

	private startHeartbeat() {
		this.stopHeartbeat();
		this.heartbeat = setInterval(() => {
			this.sendUpstream({ event: "ping" });
		}, HEARTBEAT_MS);
	}

	private stopHeartbeat() {
		if (this.heartbeat) {
			clearInterval(this.heartbeat);
			this.heartbeat = null;
		}
	}

	private scheduleIdleClose() {
		this.clearIdleTimer();
		this.idleTimer = setTimeout(() => {
			if (this.channelCount() > 0) return;
			this.intentionallyClosed = true;
			this.stopHeartbeat();
			this.socket?.close();
			this.socket = null;
			console.log(
				JSON.stringify({ level: "info", msg: "meme-ws-idle-close" }),
			);
		}, IDLE_CLOSE_MS);
	}

	private clearIdleTimer() {
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
			this.idleTimer = null;
		}
	}

	private scheduleReconnect() {
		this.clearReconnectTimer();
		const delay = Math.min(
			RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
			RECONNECT_MAX_MS,
		);
		this.reconnectAttempt += 1;
		this.reconnectTimer = setTimeout(() => this.connect(), delay);
	}

	private clearReconnectTimer() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}
}

export const memeBarHub = new MemeWsHub();
export const memeWsHub = memeBarHub;

export function isBarTypeEnum(value: string): value is BarTypeEnum {
	return (
		value === "MIN1" ||
		value === "MIN5" ||
		value === "MIN15" ||
		value === "HOUR1" ||
		value === "HOUR4" ||
		value === "DAY1"
	);
}
