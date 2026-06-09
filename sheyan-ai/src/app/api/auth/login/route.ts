import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { attachSessionCookie, createSessionToken, getSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { AppError } from "@/lib/billing";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, portal = "user" } = body as {
      email?: string;
      password?: string;
      portal?: "user" | "admin";
    };

    if (!email || !password) {
      throw new AppError("INVALID_INPUT", "请输入邮箱和密码", 400);
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) throw new AppError("INVALID_CREDENTIALS", "账号或密码错误", 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError("INVALID_CREDENTIALS", "账号或密码错误", 401);

    if (user.status === "DISABLED") throw new AppError("USER_DISABLED", "账号已被禁用", 403);

    if (portal === "admin" && user.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "无管理员权限", 403);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      nickname: user.nickname,
    });

    const redirectTo =
      portal === "admin"
        ? "/admin"
        : user.role === "ADMIN"
          ? "/admin"
          : "/chat";

    return attachSessionCookie(
      NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          role: user.role,
          balance: user.balance,
        },
        redirectTo,
      }),
      token,
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return jsonOk({ user: null });

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, nickname: true, role: true, balance: true, status: true },
    });

    return jsonOk({ user });
  } catch (error) {
    return jsonError(error);
  }
}
