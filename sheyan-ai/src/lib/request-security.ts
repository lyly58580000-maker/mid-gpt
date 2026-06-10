import { NextRequest, NextResponse } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizeHost(value: string) {
  return value.split(":")[0]?.toLowerCase() ?? "";
}

/**
 * 阻止跨站伪造写操作（CSRF）。同源 fetch 会带 Origin/Referer；纯 API 客户端需与站点同域。
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  if (!MUTATING_METHODS.has(req.method)) return null;

  const host = req.headers.get("host");
  if (!host) return null;

  const expectedHost = normalizeHost(host);
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (normalizeHost(new URL(origin).host) !== expectedHost) {
        return NextResponse.json(
          { error: { code: "CSRF_BLOCKED", message: "请求来源无效" } },
          { status: 403 },
        );
      }
      return null;
    } catch {
      return NextResponse.json(
        { error: { code: "CSRF_BLOCKED", message: "请求来源无效" } },
        { status: 403 },
      );
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      if (normalizeHost(new URL(referer).host) !== expectedHost) {
        return NextResponse.json(
          { error: { code: "CSRF_BLOCKED", message: "请求来源无效" } },
          { status: 403 },
        );
      }
      return null;
    } catch {
      /* ignore malformed referer */
    }
  }

  // 无 Origin/Referer 的跨站写请求（如 <form>）在 modern browser 通常会被拦；此处保守拒绝
  return NextResponse.json(
    { error: { code: "CSRF_BLOCKED", message: "缺少来源校验信息" } },
    { status: 403 },
  );
}

export function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  return response;
}
