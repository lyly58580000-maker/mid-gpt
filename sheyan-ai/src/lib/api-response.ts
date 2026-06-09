import { NextResponse } from "next/server";
import { AppError } from "@/lib/billing";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "无权限" } },
        { status: 403 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "服务器错误" } },
    { status: 500 },
  );
}
