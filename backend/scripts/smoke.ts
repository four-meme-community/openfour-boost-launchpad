/**
 * Local smoke: apiKey-only; reject login/record; allow invite.
 */
import { createApp } from "../src/app.ts";
import { isProxyPathAllowed } from "../src/lib/path-allowlist.ts";

async function main() {
	if (isProxyPathAllowed("/meme-api/api/v1/token/login/record")) {
		throw new Error("login/record must be denied");
	}
	if (!isProxyPathAllowed("/meme-api/api/v1/public/token/search")) {
		throw new Error("partner search must be allowed");
	}
	if (!isProxyPathAllowed("/meme-api/v1/private/invite/approve")) {
		throw new Error("web invite approve must be allowed");
	}
	if (!isProxyPathAllowed("/meme-api/v1/private/user/info")) {
		throw new Error("web user info must be allowed");
	}
	if (!isProxyPathAllowed("/meme-api/v1/public/config")) {
		throw new Error("web public config must be allowed");
	}

	const app = createApp();
	const health = await app.request("/v1/health");
	if (health.status !== 200) throw new Error("health failed");

	const denied = await app.request(
		"/v1/proxy/meme-api/api/v1/token/login/record",
		{ method: "POST", body: "{}" },
	);
	if (denied.status !== 403) {
		throw new Error(`expected 403 for login/record, got ${denied.status}`);
	}

	console.log("smoke ok");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
