import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";

const MEME_NETWORK_COOKIE = "meme-network-code";
const MEME_NETWORK_QUERY = "chain";

function networkCodeFromQuery(value: string | null): "0" | "8" {
	return String(value ?? "")
		.trim()
		.toLowerCase() === "robinhood"
		? "8"
		: "0";
}

function withNetworkCookie(response: NextResponse, request: NextRequest) {
	const fromQuery = request.nextUrl.searchParams.get(MEME_NETWORK_QUERY);
	if (fromQuery == null || fromQuery === "") return response;
	response.cookies.set(MEME_NETWORK_COOKIE, networkCodeFromQuery(fromQuery), {
		path: "/",
		maxAge: 60 * 60 * 24 * 365,
		sameSite: "lax",
	});
	return response;
}

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const firstSegment = pathname.split("/")[1] || "";
	if (isLocale(firstSegment)) {
		const headers = new Headers(request.headers);
		headers.set("x-locale", firstSegment);
		headers.set("x-pathname", pathname);
		return withNetworkCookie(
			NextResponse.next({ request: { headers } }),
			request,
		);
	}

	const saved = request.cookies.get("NEXT_LOCALE")?.value;
	const locale = saved && isLocale(saved) ? saved : defaultLocale;
	const url = request.nextUrl.clone();
	url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
	return withNetworkCookie(NextResponse.redirect(url), request);
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
