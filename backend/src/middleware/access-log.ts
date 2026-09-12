/**
 * Structured access log.
 * Security: never log Authorization / Cookie / meme-api-key headers.
 */
import { createMiddleware } from "hono/factory";
import type { RequestIdVariables } from "./request-id.js";

export const accessLogMiddleware = createMiddleware<{
	Variables: RequestIdVariables;
}>(async (c, next) => {
	const started = Date.now();
	await next();
	const line = {
		level: "info",
		msg: "access",
		requestId: c.get("requestId"),
		method: c.req.method,
		path: c.req.path,
		status: c.res.status,
		ms: Date.now() - started,
	};
	console.log(JSON.stringify(line));
});
