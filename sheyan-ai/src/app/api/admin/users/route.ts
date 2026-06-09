import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAdjustBalance, AppError } from "@/lib/billing";
import { parseUserTags, serializeUserTags } from "@/lib/user-tags";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";

    const users = await prisma.user.findMany({
      where: {
        role: "USER",
        OR: q
          ? [{ email: { contains: q } }, { nickname: { contains: q } }]
          : undefined,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        nickname: true,
        balance: true,
        tags: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { usageRecords: true } },
      },
    });

    return jsonOk({
      users: users.map((user) => ({
        ...user,
        tags: parseUserTags(user.tags),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      amount?: number;
      remark?: string;
      status?: "ACTIVE" | "DISABLED";
      tags?: string[];
    };

    if (body.tags && body.userId) {
      const user = await prisma.user.update({
        where: { id: body.userId },
        data: { tags: serializeUserTags(body.tags) },
        select: { id: true, tags: true },
      });
      return jsonOk({ tags: parseUserTags(user.tags) });
    }

    if (body.status && body.userId) {
      await prisma.user.update({
        where: { id: body.userId },
        data: { status: body.status },
      });
      return jsonOk({ success: true });
    }

    if (!body.userId || body.amount === undefined || !body.remark?.trim()) {
      throw new AppError("INVALID_INPUT", "请填写用户、变动点数和备注", 400);
    }

    await adminAdjustBalance(body.userId, body.amount, body.remark.trim());
    const user = await prisma.user.findUnique({ where: { id: body.userId } });

    return jsonOk({ balance: user?.balance ?? 0 });
  } catch (error) {
    return jsonError(error);
  }
}
