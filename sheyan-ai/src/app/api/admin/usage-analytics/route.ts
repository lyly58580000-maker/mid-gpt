import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";
import {
  getApiCostPer1kTokens,
  getApiCostPerImage,
  getQuickRouterRechargeDiscount,
} from "@/lib/api-cost";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get("days") ?? 30) || 30));
    const since = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));

    const [discount, per1k, perImage, users, usageRows] = await Promise.all([
      getQuickRouterRechargeDiscount(),
      getApiCostPer1kTokens(),
      getApiCostPerImage(),
      prisma.user.findMany({
        where: { role: "USER" },
        select: {
          id: true,
          email: true,
          nickname: true,
          createdAt: true,
          lastLoginAt: true,
          balance: true,
        },
      }),
      prisma.usageRecord.findMany({
        where: { status: "success", createdAt: { gte: since } },
        select: {
          userId: true,
          usageType: true,
          costPoints: true,
          totalTokens: true,
          estimatedCost: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const resolveCost = (row: (typeof usageRows)[number]) => {
      if (row.estimatedCost != null) return row.estimatedCost;
      if (row.usageType === "image") return perImage * discount;
      const tokens = row.totalTokens ?? 0;
      return tokens > 0 ? (tokens / 1000) * per1k * discount : 0;
    };

    const allTimeUsage = await prisma.usageRecord.groupBy({
      by: ["userId"],
      where: { status: "success" },
      _count: true,
      _sum: { costPoints: true, estimatedCost: true },
    });
    const allTimeMap = new Map(
      allTimeUsage.map((r) => [
        r.userId,
        { calls: r._count, points: r._sum.costPoints ?? 0, apiCost: r._sum.estimatedCost ?? 0 },
      ]),
    );

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const dailyMap = new Map<string, { calls: number; points: number; apiCostCny: number; users: Set<string> }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      dailyMap.set(dateKey(d), { calls: 0, points: 0, apiCostCny: 0, users: new Set() });
    }

    const userPeriod = new Map<
      string,
      { calls7d: number; points7d: number; calls30d: number; points30d: number; apiCost30d: number; lastActiveAt: Date | null }
    >();

    for (const row of usageRows) {
      const key = dateKey(new Date(row.createdAt));
      const bucket = dailyMap.get(key);
      const cost = resolveCost(row);

      if (bucket) {
        bucket.calls += 1;
        bucket.points += row.costPoints;
        bucket.apiCostCny += cost;
        bucket.users.add(row.userId);
      }

      let u = userPeriod.get(row.userId);
      if (!u) {
        u = { calls7d: 0, points7d: 0, calls30d: 0, points30d: 0, apiCost30d: 0, lastActiveAt: null };
        userPeriod.set(row.userId, u);
      }
      u.calls30d += 1;
      u.points30d += row.costPoints;
      u.apiCost30d += cost;
      if (!u.lastActiveAt || row.createdAt > u.lastActiveAt) u.lastActiveAt = row.createdAt;
      if (row.createdAt >= sevenDaysAgo) {
        u.calls7d += 1;
        u.points7d += row.costPoints;
      }
    }

    const daily = [...dailyMap.entries()].map(([date, v]) => ({
      date,
      calls: v.calls,
      points: v.points,
      apiCostCny: Number(v.apiCostCny.toFixed(4)),
      activeUsers: v.users.size,
    }));

    const userStats = users.map((u) => {
      const period = userPeriod.get(u.id);
      const all = allTimeMap.get(u.id) ?? { calls: 0, points: 0, apiCost: 0 };
      const registeredDays = Math.max(
        1,
        Math.ceil((Date.now() - u.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
      );
      const calls7d = period?.calls7d ?? 0;
      return {
        userId: u.id,
        email: u.email,
        nickname: u.nickname,
        balance: u.balance,
        registeredDays,
        calls7d,
        points7d: period?.points7d ?? 0,
        avgCallsPerDay7d: Number((calls7d / Math.min(7, registeredDays)).toFixed(2)),
        calls30d: period?.calls30d ?? 0,
        points30d: period?.points30d ?? 0,
        apiCostCny30d: Number((period?.apiCost30d ?? 0).toFixed(4)),
        callsAll: all.calls,
        pointsAll: all.points,
        apiCostCnyAll: Number(all.apiCost.toFixed(4)),
        lastActiveAt: period?.lastActiveAt ?? u.lastLoginAt,
      };
    });

    userStats.sort((a, b) => b.points30d - a.points30d || b.calls30d - a.calls30d);

    const totalCalls = usageRows.length;
    const totalPoints = usageRows.reduce((s, r) => s + r.costPoints, 0);
    const totalApiCost = usageRows.reduce((s, row) => s + resolveCost(row), 0);
    const activeUsers = new Set(usageRows.map((r) => r.userId)).size;

    return jsonOk({
      days,
      summary: {
        totalCalls,
        totalPoints,
        totalEstimatedApiCostCny: Number(totalApiCost.toFixed(4)),
        activeUsers,
        avgCallsPerActiveUserPerDay:
          activeUsers > 0 ? Number((totalCalls / days / activeUsers).toFixed(2)) : 0,
        avgPointsPerCall: totalCalls > 0 ? Number((totalPoints / totalCalls).toFixed(2)) : 0,
        avgApiCostPerPoint:
          totalPoints > 0 ? Number((totalApiCost / totalPoints).toFixed(4)) : 0,
      },
      daily,
      users: userStats,
    });
  } catch (error) {
    return jsonError(error);
  }
}
