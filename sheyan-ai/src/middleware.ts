import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/admin/login"];
const PUBLIC_API = ["/api/auth/login", "/api/auth/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/generated") ||
    pathname.startsWith("/uploads") ||
    PUBLIC_PATHS.some((p) => pathname === p) ||
    PUBLIC_API.some((p) => pathname === p)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname.startsWith("/api/auth/logout")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      if (session?.role === "ADMIN") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.next();
    }

    if (!session || session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权限" } }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/chat") || pathname.startsWith("/api/")) {
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (pathname === "/login" && session) {
    const dest = session.role === "ADMIN" ? "/admin" : "/chat";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (pathname === "/") {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.redirect(new URL(session.role === "ADMIN" ? "/admin" : "/chat", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
