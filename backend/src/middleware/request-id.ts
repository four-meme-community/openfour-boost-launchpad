/**
 * Request ID: prefer gateway/upstream X-Request-Id, else generate a UUID.
 * Helps correlate BFF ↔ meme-web ↔ logs.
 */
import { createMiddleware } from "hono/factory";
import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

export type RequestIdVariables = {
	requestId: string;
};

export const requestIdMiddleware = createMiddleware<{
	Variables: RequestIdVariables;
}>(async (c, next) => {
	const incoming = c.req.header(REQUEST_ID_HEADER)?.trim();
	const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
	c.set("requestId", requestId);
	c.header(REQUEST_ID_HEADER, requestId);
	await next();
});
