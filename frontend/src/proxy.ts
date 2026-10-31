import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, verifyToken } from "@/utils/authToken";

// 로그인 없이 접근할 수 있는 경로
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/status"];

export function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (verifyToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ detail: "로그인이 필요합니다." }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
