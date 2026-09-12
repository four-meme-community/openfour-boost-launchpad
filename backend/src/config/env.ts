/**
 * Single entry for environment variables.
 *
 * Security: `MEME_API_KEY` must never appear in public APIs.
 */
import { z } from "zod";

const EnvSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	PORT: z.coerce.number().int().positive().default(8787),
	HOST: z.string().default("0.0.0.0"),

	MEME_WEB_BASE_URL: z
		.string()
		.url()
		.describe("meme-web origin; BFF sole upstream business source"),
	MEME_API_KEY: z
		.string()
		.min(8)
		.describe("partner apiKey; sent as meme-api-key header"),

	MEME_WEB_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

	/** meme-web market WebSocket; BFF-only — frontend must not connect directly */
	MEME_WS_URL: z
		.string()
		.url()
		.default("wss://ws.four.meme/ws"),

	CORS_ORIGINS: z.string().default("http://localhost:3000"),

	SITE_NAME: z.string().min(1).default("OpenFour Boost"),
	SITE_TAGLINE: z.string().default(""),
	SITE_LOGO_URL: z.string().default(""),
	SITE_PRIMARY_COLOR: z.string().default("#111111"),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
	const parsed = EnvSchema.safeParse(process.env);
	if (!parsed.success) {
		const detail = parsed.error.flatten().fieldErrors;
		console.error("[config] invalid environment", detail);
		throw new Error("Invalid environment configuration");
	}
	return Object.freeze(parsed.data);
}

export const env = loadEnv();

export function corsOriginList(): string[] {
	return env.CORS_ORIGINS.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

export function publicSiteConfig() {
	return {
		name: env.SITE_NAME,
		tagline: env.SITE_TAGLINE,
		logoUrl: env.SITE_LOGO_URL || null,
		primaryColor: env.SITE_PRIMARY_COLOR,
	} as const;
}
