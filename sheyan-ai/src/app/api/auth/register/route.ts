import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachSessionCookie, createSessionToken } from "@/lib/auth";
import { jsonError } from "@/lib/api-response";
import { getConfigBool } from "@/lib/system-config";
import { AppError } from "@/lib/billing";

export async function POST(req: NextRequest) {
  try {
    const registerEnabled = await getConfigBool("register_enabled", true);
    if (!registerEnabled) throw new AppError("REGISTER_DISABLED", "当前暂不开放注册", 403);

    const body = await req.json();
    const { email, password, nickname } = body as {
      email?: string;
      password?: string;
      nickname?: string;
    };

    if (!email || !password || password.length < 6) {
      throw new AppError("INVALID_INPUT", "请输入有效邮箱和至少6位密码", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new AppError("EMAIL_EXISTS", "该邮箱已注册，请直接登录", 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        nickname: nickname?.trim() || normalizedEmail.split("@")[0],
        balance: 0,
      },
    });

    await prisma.chatGroup.create({
      data: { userId: user.id, name: "默认分组", isDefault: true, sortOrder: 0 },
    });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      nickname: user.nickname,
    });

    return attachSessionCookie(
      NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          role: user.role,
          balance: user.balance,
        },
        redirectTo: "/chat",
      }),
      token,
    );
  } catch (error) {
    return jsonError(error);
  }
}
