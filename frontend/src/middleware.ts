import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const firstSegment = pathname.split("/")[1] || "";
	if (isLocale(firstSegment)) {
		const headers = new Headers(request.headers);
		headers.set("x-locale", firstSegment);
		headers.set("x-pathname", pathname);
		return NextResponse.next({ request: { headers } });
	}

	const saved = request.cookies.get("NEXT_LOCALE")?.value;
	const locale = saved && isLocale(saved) ? saved : defaultLocale;
	const url = request.nextUrl.clone();
	url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
	return NextResponse.redirect(url);
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
