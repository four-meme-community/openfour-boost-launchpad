import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

const MEME_NETWORK_COOKIE = "meme-network-code";
const LOCALE_COOKIE = "NEXT_LOCALE";
/** Path segment = chain `query`. Both `/bsc/...` and `/robinhood/...` are used. */
const CHAIN_PATH_QUERIES = new Set(["bsc", "robinhood"]);
const DEFAULT_CHAIN_QUERY = "bsc";

function networkCodeFromQuery(query: string): "0" | "8" {
	return query === "robinhood" ? "8" : "0";
}

function isChainPathQuery(value: string): boolean {
	return CHAIN_PATH_QUERIES.has(value.trim().toLowerCase());
}

function parsePath(pathname: string): {
	locale: Locale | null;
	chainQuery: string | null;
	routePath: string;
} {
	const segments = pathname.split("/").filter(Boolean);
	let i = 0;
	let locale: Locale | null = null;
	if (segments[i] && isLocale(segments[i])) {
		locale = segments[i] as Locale;
		i += 1;
	}
	let chainQuery: string | null = null;
	if (segments[i] && isChainPathQuery(segments[i])) {
		chainQuery = segments[i].toLowerCase();
		i += 1;
	}
	const rest = segments.slice(i);
	const routePath = rest.length === 0 ? "/" : `/${rest.join("/")}`;
	return { locale, chainQuery, routePath };
}

function buildPublicPath(routePath: string, chainQuery: string): string {
	return routePath === "/" ? `/${chainQuery}` : `/${chainQuery}${routePath}`;
}

function resolveLocale(request: NextRequest, fromPath: Locale | null): Locale {
	if (fromPath) return fromPath;
	const saved = request.cookies.get(LOCALE_COOKIE)?.value;
	return saved && isLocale(saved) ? saved : defaultLocale;
}

function withHeaders(
	response: NextResponse,
	opts: { locale: Locale; routePath: string; networkCode: string },
) {
	response.headers.set("x-locale", opts.locale);
	response.headers.set("x-pathname", opts.routePath);
	response.headers.set("x-meme-network-code", opts.networkCode);
	response.cookies.set(MEME_NETWORK_COOKIE, opts.networkCode, {
		path: "/",
		maxAge: 60 * 60 * 24 * 365,
		sameSite: "lax",
	});
	response.cookies.set(LOCALE_COOKIE, opts.locale, {
		path: "/",
		maxAge: 60 * 60 * 24 * 365,
		sameSite: "lax",
	});
	return response;
}

export function middleware(request: NextRequest) {
	const { pathname, searchParams } = request.nextUrl;
	const parsed = parsePath(pathname);
	const locale = resolveLocale(request, parsed.locale);

	const chainFromQueryRaw = searchParams.get("chain");
	const chainFromQuery =
		chainFromQueryRaw && isChainPathQuery(chainFromQueryRaw)
			? chainFromQueryRaw.trim().toLowerCase()
			: null;

	// Path (and legacy ?chain=) is the source of truth — cookie follows, never leads.
	const effectiveChain =
		chainFromQuery || parsed.chainQuery || DEFAULT_CHAIN_QUERY;

	const publicPath = buildPublicPath(parsed.routePath, effectiveChain);
	const needsLocaleStrip = Boolean(parsed.locale);
	const needsQueryStrip = Boolean(chainFromQuery);
	const needsChainPrefix = !parsed.chainQuery;

	if (needsLocaleStrip || needsQueryStrip || needsChainPrefix) {
		const target = request.nextUrl.clone();
		target.pathname = publicPath;
		if (needsQueryStrip) target.searchParams.delete("chain");
		const networkCode = networkCodeFromQuery(effectiveChain);
		const res = NextResponse.redirect(target);
		return withHeaders(res, {
			locale,
			routePath: parsed.routePath,
			networkCode,
		});
	}

	const networkCode = networkCodeFromQuery(parsed.chainQuery || DEFAULT_CHAIN_QUERY);

	// Public URL keeps /{chain}/…; rewrite to the real app route underneath.
	const rewriteUrl = request.nextUrl.clone();
	rewriteUrl.pathname = parsed.routePath;
	const headers = new Headers(request.headers);
	headers.set("x-locale", locale);
	headers.set("x-pathname", parsed.routePath);
	headers.set("x-meme-network-code", networkCode);
	const res = NextResponse.rewrite(rewriteUrl, { request: { headers } });
	return withHeaders(res, {
		locale,
		routePath: parsed.routePath,
		networkCode,
	});
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
