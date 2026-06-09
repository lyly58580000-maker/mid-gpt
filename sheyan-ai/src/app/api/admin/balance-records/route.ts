import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/billing";
import { fetchQuickRouterQuota } from "@/lib/quickrouter-quota";
import { parseUserTags } from "@/lib/user-tags";
import { jsonOk, jsonError } from "@/lib/api-response";

type SortMode = "newest" | "oldest" | "usage" | "frequency" | "balance";

function getOrderBy(sort: SortMode) {
  switch (sort) {
    case "oldest":
      return { createdAt: "asc" as const };
    case "balance":
      return { balance: "desc" as const };
    case "newest":
    default:
      return { createdAt: "desc" as const };
  }
}

export async function GET(req: NextRequest) {
  try {
    const sort = (req.nextUrl.searchParams.get("sort") ?? "newest") as SortMode;
    const tag = req.nextUrl.searchParams.get("tag")?.trim() ?? "";
    const userId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";

    const apiQuota = await fetchQuickRouterQuota();

    if (userId) {
      const user = await prisma.user.findFirst({
        where: { id: userId, role: "USER" },
        select: {
          id: true,
          email: true,
          nickname: true,
          balance: true,
          tags: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      if (!user) throw new AppError("NOT_FOUND", "用户不存在", 404);

      const [records, usageAgg, recentUsage] = await Promise.all([
        prisma.balanceRecord.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
        prisma.usageRecord.aggregate({
          where: { userId, status: "success" },
          _count: true,
          _sum: { costPoints: true },
        }),
        prisma.usageRecord.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        }),
      ]);

      return jsonOk({
        apiQuota,
        user: {
          ...user,
          tags: parseUserTags(user.tags),
          usageCount: usageAgg._count,
          totalConsumed: usageAgg._sum.costPoints ?? 0,
          lastActiveAt: recentUsage[0]?.createdAt ?? user.lastLoginAt,
        },
        records,
      });
    }

    const users = await prisma.user.findMany({
      where: { role: "USER" },
      orderBy: getOrderBy(sort),
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
        usageRecords: {
          where: { status: "success" },
          select: { costPoints: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        balanceRecords: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            changeType: true,
            amount: true,
            balanceAfter: true,
            remark: true,
            createdAt: true,
          },
        },
      },
    });

    const summaries = users
      .map((user) => {
        const totalConsumed = user.usageRecords.reduce((sum, item) => sum + item.costPoints, 0);
        const lastActiveAt =
          user.usageRecords[0]?.createdAt ?? user.lastLoginAt ?? user.createdAt;

        return {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          balance: user.balance,
          tags: parseUserTags(user.tags),
          status: user.status,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          usageCount: user._count.usageRecords,
          totalConsumed,
          lastActiveAt,
          recentRecords: user.balanceRecords,
        };
      })
      .filter((user) => (tag ? user.tags.includes(tag) : true));

    summaries.sort((a, b) => {
      switch (sort) {
        case "usage":
          return b.totalConsumed - a.totalConsumed;
        case "frequency":
          return b.usageCount - a.usageCount;
        case "balance":
          return b.balance - a.balance;
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    const allTags = [...new Set(summaries.flatMap((user) => user.tags))].sort();

    return jsonOk({
      apiQuota,
      users: summaries,
      allTags,
    });
  } catch (error) {
    return jsonError(error);
  }
}
