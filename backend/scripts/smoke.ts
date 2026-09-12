/**
 * Local + live smoke. Fails if BFF crashes, leaks secrets, or cannot
 * reach the public meme-web APIs used by the frontend.
 */
import { createApp } from "../src/app.ts";
import {
	isTokenCreatePath,
	omitEmptyCreateMediaFields,
	rewriteCreateTokenBody,
} from "../src/lib/create-payload.ts";
import { isProxyPathAllowed } from "../src/lib/path-allowlist.ts";

const CREATE_PATH = "/meme-api/v1/private/token_template/token/create";
const failures: string[] = [];

function check(ok: boolean, name: string, detail?: string) {
	if (ok) {
		console.log(`ok  ${name}${detail ? `  ${detail}` : ""}`);
		return;
	}
	const msg = detail ? `${name}: ${detail}` : name;
	failures.push(msg);
	console.error(`FAIL  ${msg}`);
}

function jsonBuf(value: unknown): ArrayBuffer {
	return new TextEncoder().encode(JSON.stringify(value)).buffer;
}

function decodeBody(body: ArrayBuffer | string | null): unknown {
	if (body == null) return null;
	const text =
		typeof body === "string" ? body : new TextDecoder().decode(body);
	return JSON.parse(text);
}

async function readJson(res: Response): Promise<{
	status: number;
	body: Record<string, unknown>;
	raw: string;
}> {
	const raw = await res.text();
	let body: Record<string, unknown> = {};
	try {
		body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
	} catch {
		body = { _nonJson: raw.slice(0, 200) };
	}
	return { status: res.status, body, raw };
}

function isBffCrash(status: number, body: Record<string, unknown>): boolean {
	const err = body.error;
	if (err && typeof err === "object" && !Array.isArray(err)) {
		const code = (err as { code?: unknown }).code;
		if (code === "internal_error") return true;
	}
	return status === 500 && body.ok === false;
}

async function main() {
	check(
		!isProxyPathAllowed("/meme-api/api/v1/token/login/record"),
		"deny login/record",
	);
	check(
		isProxyPathAllowed("/meme-api/api/v1/public/token/search"),
		"allow partner search",
	);
	check(
		isProxyPathAllowed("/meme-api/v1/private/invite/approve"),
		"allow web invite",
	);
	check(
		isProxyPathAllowed("/meme-api/v1/private/user/info"),
		"allow web user info",
	);
	check(isProxyPathAllowed("/meme-api/v1/public/config"), "allow public config");
	check(isTokenCreatePath(CREATE_PATH), "recognize create path");
	check(!isTokenCreatePath("/meme-api/v1/public/config"), "ignore non-create");

	const omitted = omitEmptyCreateMediaFields({
		name: "x",
		webUrl: "",
		twitterUrl: "  ",
		telegramUrl: "https://t.me/ok",
		discord: null,
		desc: "hello",
	});
	check(!("webUrl" in omitted), "omit empty webUrl");
	check(!("twitterUrl" in omitted), "omit blank twitterUrl");
	check(!("discord" in omitted), "omit null discord");
	check(
		omitted.telegramUrl === "https://t.me/ok",
		"keep valid telegramUrl",
	);

	const droppedPlaceholder = omitEmptyCreateMediaFields({
		webUrl: "https://",
		twitterUrl: "https://x.com/ok",
	});
	check(!("webUrl" in droppedPlaceholder), "omit incomplete https:// webUrl");
	check(
		droppedPlaceholder.twitterUrl === "https://x.com/ok",
		"keep complete twitterUrl beside placeholder",
	);

	const rewritten = rewriteCreateTokenBody(
		CREATE_PATH,
		jsonBuf({
			name: "x",
			webUrl: "",
			twitterUrl: "https://x.com/ok",
		}),
	);
	const rewrittenJson = decodeBody(rewritten) as Record<string, unknown>;
	check(!("webUrl" in rewrittenJson), "rewrite drops empty webUrl");
	check(
		rewrittenJson.twitterUrl === "https://x.com/ok",
		"rewrite keeps valid twitterUrl",
	);

	const untouched = rewriteCreateTokenBody(
		"/meme-api/v1/public/config",
		jsonBuf({ webUrl: "" }),
	);
	check(
		(decodeBody(untouched) as { webUrl: string }).webUrl === "",
		"non-create body unchanged",
	);

	const app = createApp();

	const health = await readJson(await app.request("/v1/health"));
	check(health.status === 200 && health.body.ok === true, "GET /v1/health");

	const denied = await readJson(
		await app.request("/v1/proxy/meme-api/api/v1/token/login/record", {
			method: "POST",
			body: "{}",
		}),
	);
	check(denied.status === 403, "POST login/record → 403", String(denied.status));

	const ssrf = await readJson(
		await app.request("/v1/proxy/https://example.com/", { method: "GET" }),
	);
	check(ssrf.status === 403, "reject absolute proxy URL", String(ssrf.status));

	const traversal = await readJson(
		await app.request("/v1/proxy/meme-api/../etc/passwd", { method: "GET" }),
	);
	check(
		traversal.status === 403,
		"reject path traversal",
		String(traversal.status),
	);

	const config = await readJson(await app.request("/v1/config"));
	check(config.status === 200 && config.body.ok === true, "GET /v1/config");
	const configRaw = JSON.stringify(config.body);
	const apiKey = process.env.MEME_API_KEY || "";
	check(
		!apiKey || !configRaw.includes(apiKey),
		"config does not leak MEME_API_KEY",
	);
	check(!configRaw.includes("MEME_WEB_BASE_URL"), "config omits upstream URL");

	const data = (config.body.data || {}) as {
		name?: string;
		chains?: Array<{
			key: string;
			code: string;
			walletNetworkCode: string;
			presetIds?: string[];
		}>;
		defaultChain?: string;
	};
	const chains = data.chains || [];
	check(chains.length > 0, "config has chains", `count=${chains.length}`);
	check(Boolean(data.defaultChain), "config has defaultChain", data.defaultChain);

	type ChainProbe = {
		key: string;
		code: string;
		walletNetworkCode: string;
		presetIds: string[];
	};
	const probes: ChainProbe[] = chains.map((chain) => ({
		key: chain.key,
		code: chain.code,
		walletNetworkCode: chain.walletNetworkCode,
		presetIds: Array.isArray(chain.presetIds) ? chain.presetIds : [],
	}));
	for (const chain of probes) {
		check(
			chain.presetIds.length > 0,
			`${chain.key} has presetIds`,
			chain.presetIds.join(","),
		);
	}

	async function proxyGet(path: string, networkCode: string) {
		return readJson(
			await app.request(`/v1/proxy${path}`, {
				headers: {
					accept: "application/json",
					"meme-network-code": networkCode,
				},
			}),
		);
	}

	async function proxyPost(
		path: string,
		networkCode: string,
		body: unknown,
		extraHeaders?: Record<string, string>,
	) {
		return readJson(
			await app.request(`/v1/proxy${path}`, {
				method: "POST",
				headers: {
					accept: "application/json",
					"content-type": "application/json",
					"meme-network-code": networkCode,
					...extraHeaders,
				},
				body: JSON.stringify(body),
			}),
		);
	}

	for (const chain of probes) {
		const addr = await proxyGet(
			`/meme-api/api/v1/public/address?networkCode=${chain.walletNetworkCode}`,
			chain.code,
		);
		const addrCode = addr.body.code;
		const rows = Array.isArray(addr.body.data)
			? (addr.body.data as Array<{ name?: string; address?: string }>)
			: [];
		const names = new Set(rows.map((row) => row.name));
		check(
			addr.status === 200 && addrCode === 0,
			`${chain.key} address API`,
			`http=${addr.status} code=${String(addrCode)} n=${rows.length}`,
		);
		for (const name of ["OpenFourCore", "OpenFourTools", "OpenFourRegistry"]) {
			check(names.has(name), `${chain.key} has ${name}`);
		}

		const publicCfg = await proxyGet("/meme-api/v1/public/config", chain.code);
		check(
			publicCfg.status === 200 && publicCfg.body.code === 0,
			`${chain.key} public config`,
			`http=${publicCfg.status} code=${String(publicCfg.body.code)}`,
		);

		const tokens = await readJson(
			await app.request(
				`/v1/tokens?pageIndex=1&pageSize=5&type=NEW&listType=TEP&status=PUBLISH&version=V12`,
				{ headers: { "meme-network-code": chain.code } },
			),
		);
		check(
			tokens.status === 200 && tokens.body.code === 0,
			`${chain.key} GET /v1/tokens`,
			`http=${tokens.status} code=${String(tokens.body.code)} n=${
				Array.isArray(tokens.body.data) ? tokens.body.data.length : 0
			}`,
		);

		for (const presetId of chain.presetIds) {
			const tmpl = await proxyGet(
				`/meme-api/v1/public/token_template/config?templateId=${presetId}`,
				chain.code,
			);
			const list = Array.isArray(tmpl.body.data) ? tmpl.body.data : [];
			check(
				tmpl.status === 200 && tmpl.body.code === 0,
				`${chain.key} template ${presetId}`,
				`http=${tmpl.status} code=${String(tmpl.body.data === undefined ? tmpl.body.code : tmpl.body.code)} quotes=${list.length}`,
			);
			check(
				list.length > 0,
				`${chain.key} template ${presetId} has quote assets`,
				list.length === 0
					? "empty — create page will fail on this preset"
					: `n=${list.length}`,
			);
		}
	}

	const ticker = await proxyPost("/meme-api/v1/public/ticker", "0", {});
	check(
		ticker.status === 200 && ticker.body.code === 0,
		"POST ticker",
		`http=${ticker.status} code=${String(ticker.body.code)}`,
	);

	const sampleQuote =
		probes[0] && probes[0].presetIds[0]
			? (
					await proxyGet(
						`/meme-api/v1/public/token_template/config?templateId=${probes[0].presetIds[0]}`,
						probes[0].code,
					)
				).body.data
			: [];
	const quote = Array.isArray(sampleQuote)
		? (sampleQuote[0] as {
				symbol?: string;
				raisedAmount?: unknown;
				saleAmount?: unknown;
				totalSupply?: unknown;
			} | undefined)
		: undefined;

	const createBody = {
		templateId: Number(probes[0]?.presetIds[0] || 0),
		imgUrl: "https://static.four.meme/market/smoke.png",
		name: "SmokeTest",
		shortName: "SMOKE",
		symbol: quote?.symbol || "BNB",
		desc: "backend live smoke",
		webUrl: "",
		twitterUrl: "",
		telegramUrl: "",
		presaleQuote: 0,
		feePlan: true,
		raisedAmount: quote?.raisedAmount ?? "24",
		saleAmount: Number(quote?.saleAmount) || 800000000,
		totalSupply: Number(quote?.totalSupply) || 1000000000,
		initParams: {
			tokenParams: "0x",
			vaultParams: "0x",
			curveParams: "0x",
			tradeParams: "0x",
			migrateParams: "0x",
			customDataParams: "0x",
		},
	};

	const createNoAuth = await proxyPost(CREATE_PATH, probes[0]?.code || "0", createBody);
	check(
		!isBffCrash(createNoAuth.status, createNoAuth.body),
		"create without session does not crash BFF",
		`http=${createNoAuth.status} code=${String(createNoAuth.body.code)} msg=${String(createNoAuth.body.msg || createNoAuth.body.error || "").slice(0, 160)}`,
	);
	check(
		createNoAuth.status !== 500 || Number(createNoAuth.body.code) !== -1000,
		"create without session is not upstream -1000",
		`http=${createNoAuth.status} body=${createNoAuth.raw.slice(0, 180)}`,
	);

	const createEmptyMedia = await proxyPost(
		CREATE_PATH,
		probes[0]?.code || "0",
		createBody,
	);
	check(
		!isBffCrash(createEmptyMedia.status, createEmptyMedia.body),
		"create with empty media fields does not crash BFF",
		`http=${createEmptyMedia.status} code=${String(createEmptyMedia.body.code)} msg=${String(createEmptyMedia.body.msg || "").slice(0, 160)}`,
	);

	if (failures.length) {
		console.error(`\n${failures.length} smoke check(s) failed`);
		for (const item of failures) console.error(` - ${item}`);
		process.exit(1);
	}
	console.log("\nsmoke ok");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
