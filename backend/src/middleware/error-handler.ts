/**
 * Unified error handler.
 * In production, never return internal stacks / upstream details to clients.
 */
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "../config/env.js";
import type { RequestIdVariables } from "./request-id.js";

export type AppVariables = RequestIdVariables;

export const errorHandler: ErrorHandler<{ Variables: AppVariables }> = (
	err,
	c,
) => {
	const requestId = c.get("requestId") ?? "unknown";

	if (err instanceof HTTPException) {
		return c.json(
			{
				ok: false,
				error: {
					code: `http_${err.status}`,
					message: err.message,
					requestId,
				},
			},
			err.status,
		);
	}

	console.error(
		JSON.stringify({
			level: "error",
			msg: "unhandled",
			requestId,
			error: err instanceof Error ? err.message : String(err),
			stack:
				env.NODE_ENV === "development" && err instanceof Error
					? err.stack
					: undefined,
		}),
	);

	return c.json(
		{
			ok: false,
			error: {
				code: "internal_error",
				message: "Internal server error",
				requestId,
			},
		},
		500,
	);
};
