import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachSessionCookie, createSessionToken } from "@/lib/auth";
import { jsonError } from "@/lib/api-response";
import { getConfigBool, getConfigInt } from "@/lib/system-config";
import { AppError } from "@/lib/billing";
import { BalanceChangeType } from "@prisma/client";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/request-security";

export async function POST(req: NextRequest) {
  try {
    const blocked = assertSameOrigin(req);
    if (blocked) return blocked;

    const ip = getClientIp(req);
    const limit = checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!limit.ok) {
      throw new AppError(
        "RATE_LIMITED",
        `注册尝试过多，请 ${limit.retryAfterSec} 秒后再试`,
        429,
      );
    }

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

    const welcomePoints = await getConfigInt("register_welcome_points", 15);
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          nickname: nickname?.trim() || normalizedEmail.split("@")[0],
          balance: welcomePoints,
        },
      });

      if (welcomePoints > 0) {
        await tx.balanceRecord.create({
          data: {
            userId: created.id,
            changeType: BalanceChangeType.system_gift,
            amount: welcomePoints,
            balanceBefore: 0,
            balanceAfter: welcomePoints,
            remark: "新用户注册赠送",
          },
        });
      }

      await tx.chatGroup.create({
        data: { userId: created.id, name: "默认分组", isDefault: true, sortOrder: 0 },
      });

      return created;
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
        welcomePoints,
        redirectTo: "/chat",
      }),
      token,
    );
  } catch (error) {
    return jsonError(error);
  }
}
