/**
 * Frontend realtime streams (SSE).
 *
 * Browser → BFF `/v1/stream/*` → shared upstream meme-web WS
 * Frontend must not connect to meme-web WebSocket directly.
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
	isBarTypeEnum,
	memeWsHub,
	type BarPush,
	type FillPush,
} from "../lib/bar-hub.js";
import type { AppVariables } from "../middleware/error-handler.js";

export const streamRoutes = new Hono<{ Variables: AppVariables }>();

streamRoutes.get("/bars", async (c) => {
	const tokenId = Number(c.req.query("tokenId"));
	const typeEnumRaw = c.req.query("typeEnum") || "MIN5";

	if (!Number.isFinite(tokenId) || tokenId <= 0) {
		return c.json(
			{
				ok: false,
				error: {
					code: "bad_request",
					message: "tokenId required",
					requestId: c.get("requestId"),
				},
			},
			400,
		);
	}
	if (!isBarTypeEnum(typeEnumRaw)) {
		return c.json(
			{
				ok: false,
				error: {
					code: "bad_request",
					message: "invalid typeEnum",
					requestId: c.get("requestId"),
				},
			},
			400,
		);
	}

	const typeEnum = typeEnumRaw;
	const requestId = c.get("requestId");

	return streamSSE(c, async (stream) => {
		let closed = false;
		let seq = 0;

		const write = async (event: string, data: unknown) => {
			if (closed) return;
			await stream.writeSSE({
				id: String(++seq),
				event,
				data: JSON.stringify(data),
			});
		};

		const onBar = (bar: BarPush) => {
			void write("bar", bar);
		};

		const unsubscribe = memeWsHub.subscribeBar(tokenId, typeEnum, onBar);

		stream.onAbort(() => {
			closed = true;
			unsubscribe();
		});

		await write("ready", {
			tokenId,
			typeEnum,
			requestId,
			hub: memeWsHub.stats(),
		});

		while (!closed) {
			await stream.sleep(15_000);
			await write("ping", { t: Date.now() });
		}
	});
});

/** Per-token fill stream: upstream `{tokenId}@FILL_EVENT@0` */
streamRoutes.get("/fills", async (c) => {
	const tokenId = Number(c.req.query("tokenId"));

	if (!Number.isFinite(tokenId) || tokenId <= 0) {
		return c.json(
			{
				ok: false,
				error: {
					code: "bad_request",
					message: "tokenId required",
					requestId: c.get("requestId"),
				},
			},
			400,
		);
	}

	const requestId = c.get("requestId");

	return streamSSE(c, async (stream) => {
		let closed = false;
		let seq = 0;

		const write = async (event: string, data: unknown) => {
			if (closed) return;
			await stream.writeSSE({
				id: String(++seq),
				event,
				data: JSON.stringify(data),
			});
		};

		const onFill = (fill: FillPush) => {
			void write("fill", fill);
		};

		const unsubscribe = memeWsHub.subscribeFill(tokenId, onFill);

		stream.onAbort(() => {
			closed = true;
			unsubscribe();
		});

		await write("ready", {
			tokenId,
			requestId,
			hub: memeWsHub.stats(),
		});

		while (!closed) {
			await stream.sleep(15_000);
			await write("ping", { t: Date.now() });
		}
	});
});

streamRoutes.get("/hub", (c) =>
	c.json({
		ok: true,
		data: memeWsHub.stats(),
		requestId: c.get("requestId"),
	}),
);
