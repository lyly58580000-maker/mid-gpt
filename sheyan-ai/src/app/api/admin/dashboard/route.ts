import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      todayUsers,
      todayUsage,
      todayText,
      todayImage,
      todayPoints,
      totalBalance,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "USER" } }),
      prisma.user.count({ where: { role: "USER", createdAt: { gte: today } } }),
      prisma.usageRecord.count({ where: { createdAt: { gte: today }, status: "success" } }),
      prisma.usageRecord.count({ where: { createdAt: { gte: today }, status: "success", usageType: "text" } }),
      prisma.usageRecord.count({ where: { createdAt: { gte: today }, status: "success", usageType: "image" } }),
      prisma.usageRecord.aggregate({
        where: { createdAt: { gte: today }, status: "success" },
        _sum: { costPoints: true },
      }),
      prisma.user.aggregate({ where: { role: "USER" }, _sum: { balance: true } }),
    ]);

    const recentUsage = await prisma.usageRecord.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        status: "success",
      },
      select: { createdAt: true },
    });

    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const label = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const count = recentUsage.filter((item) => {
        const t = new Date(item.createdAt);
        return t >= d && t < next;
      }).length;
      return { name: label, calls: count, users: Math.max(0, Math.floor(count / 3)) };
    });

    const modelStats = await prisma.usageRecord.groupBy({
      by: ["modelName", "usageType"],
      _count: true,
      _sum: { costPoints: true, totalTokens: true },
      where: { status: "success" },
    });

    return jsonOk({
      stats: {
        totalUsers,
        todayUsers,
        todayUsage,
        todayText,
        todayImage,
        todayPoints: todayPoints._sum.costPoints ?? 0,
        totalBalance: totalBalance._sum.balance ?? 0,
      },
      chartData: last7Days,
      modelStats: modelStats.map((m) => ({
        modelName: m.modelName,
        usageType: m.usageType,
        count: m._count,
        points: m._sum.costPoints ?? 0,
        tokens: m._sum.totalTokens ?? 0,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
