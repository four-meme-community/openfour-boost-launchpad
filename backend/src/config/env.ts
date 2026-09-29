/**
 * Single entry for environment variables.
 *
 * Security: `MEME_API_KEY` must never appear in public APIs.
 */
import { z } from "zod";
import { resolvePublicChains } from "./chains.js";
import {
	DEFAULT_CREATE_PRESETS,
	parseCreatePresetMap,
	presetIdsForChain,
} from "./create-presets.js";

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

	/**
	 * When true (default), token list search sends filterByPartner so meme-web
	 * only returns tokens created under this deploy's MEME_API_KEY.
	 */
	FILTER_BY_PARTNER: z
		.enum(["true", "false"])
		.default("true")
		.transform((v) => v === "true"),

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

	/**
	 * Comma-separated catalog keys shown in the frontend switcher.
	 * Keys: bsc, bsc-testnet, robinhood, robinhood-testnet
	 */
	ENABLED_CHAINS: z.string().min(1).default("bsc-testnet,robinhood-testnet"),
	/** Catalog key or family id (bsc / robinhood). Must be in ENABLED_CHAINS. */
	DEFAULT_CHAIN: z.string().min(1).default("bsc-testnet"),

	/**
	 * Per-chain OpenFour create preset IDs.
	 * Format: `key:id,id;key:id`  (catalog key or family id).
	 */
	CREATE_PRESETS: z.string().default(DEFAULT_CREATE_PRESETS),
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

export const publicChains = resolvePublicChains({
	enabledChains: env.ENABLED_CHAINS,
	defaultChain: env.DEFAULT_CHAIN,
});

export const createPresetMap = parseCreatePresetMap(env.CREATE_PRESETS);

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
		chains: publicChains.chains.map((chain) => ({
			...chain,
			presetIds: presetIdsForChain(createPresetMap, chain),
		})),
		defaultChain: publicChains.defaultChain,
	} as const;
}
