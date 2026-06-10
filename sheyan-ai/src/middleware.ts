import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { applySecurityHeaders, assertSameOrigin } from "@/lib/request-security";

const PUBLIC_PATHS = ["/login", "/admin/login"];
const PUBLIC_API = ["/api/auth/login", "/api/auth/register"];

function withSecurityHeaders(response: NextResponse) {
  return applySecurityHeaders(response);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/admin")) {
    const blocked = assertSameOrigin(request);
    if (blocked) return withSecurityHeaders(blocked);

    const ip = getClientIp(request);
    const limit = checkRateLimit(`admin-api:${ip}`, 120, 60 * 1000);
    if (!limit.ok) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: { code: "RATE_LIMITED", message: "请求过于频繁，请稍后再试" } },
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
        ),
      );
    }
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/generated") ||
    pathname.startsWith("/uploads") ||
    PUBLIC_PATHS.some((p) => pathname === p) ||
    PUBLIC_API.some((p) => pathname === p)
  ) {
    return withSecurityHeaders(NextResponse.next());
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname.startsWith("/api/auth/logout")) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      if (session?.role === "ADMIN") {
        return withSecurityHeaders(NextResponse.redirect(new URL("/admin", request.url)));
      }
      return withSecurityHeaders(NextResponse.next());
    }

    if (!session || session.role !== "ADMIN") {
      return withSecurityHeaders(NextResponse.redirect(new URL("/admin/login", request.url)));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/api/admin")) {
    if (!session || session.role !== "ADMIN") {
      return withSecurityHeaders(
        NextResponse.json({ error: { code: "FORBIDDEN", message: "无权限" } }, { status: 403 }),
      );
    }
    return withSecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/chat") || pathname.startsWith("/api/")) {
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return withSecurityHeaders(
          NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 }),
        );
      }
      return withSecurityHeaders(NextResponse.redirect(new URL("/login", request.url)));
    }
  }

  if (pathname === "/login" && session) {
    const dest = session.role === "ADMIN" ? "/admin" : "/chat";
    return withSecurityHeaders(NextResponse.redirect(new URL(dest, request.url)));
  }

  if (pathname === "/") {
    if (!session) return withSecurityHeaders(NextResponse.redirect(new URL("/login", request.url)));
    return withSecurityHeaders(
      NextResponse.redirect(new URL(session.role === "ADMIN" ? "/admin" : "/chat", request.url)),
    );
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
