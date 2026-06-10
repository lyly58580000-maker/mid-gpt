import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0 && !line.startsWith("#")) {
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const prisma = new PrismaClient();

async function main() {
  const textCharge = Number(process.env.TEXT_CHARGE_POINTS ?? 1);
  const imageCharge = Number(process.env.IMAGE_CHARGE_POINTS ?? 5);
  const welcomePoints = await prisma.systemConfig.findUnique({
    where: { configKey: "register_welcome_points" },
  });

  const success = await prisma.usageRecord.findMany({
    where: { status: "success" },
    select: {
      usageType: true,
      costPoints: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      responseMs: true,
      modelName: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const refunded = await prisma.usageRecord.count({ where: { status: "refunded" } });
  const failed = await prisma.usageRecord.count({ where: { status: "failed" } });

  const byType = {
    text: success.filter((r) => r.usageType === "text"),
    image: success.filter((r) => r.usageType === "image"),
  };

  const sumTokens = (rows: typeof success) => ({
    count: rows.length,
    points: rows.reduce((s, r) => s + r.costPoints, 0),
    inputTokens: rows.reduce((s, r) => s + (r.inputTokens ?? 0), 0),
    outputTokens: rows.reduce((s, r) => s + (r.outputTokens ?? 0), 0),
    totalTokens: rows.reduce((s, r) => s + (r.totalTokens ?? 0), 0),
    avgResponseMs:
      rows.length > 0 ? Math.round(rows.reduce((s, r) => s + (r.responseMs ?? 0), 0) / rows.length) : 0,
  });

  const textStats = sumTokens(byType.text);
  const imageStats = sumTokens(byType.image);

  const gifts = await prisma.balanceRecord.aggregate({
    where: { changeType: "system_gift" },
    _sum: { amount: true },
    _count: true,
  });

  const consumed = await prisma.balanceRecord.aggregate({
    where: { changeType: "consume" },
    _sum: { amount: true },
    _count: true,
  });

  const users = await prisma.user.count({ where: { role: "USER" } });

  // QuickRouter 账户级历史消耗（元）
  const qrUsedCny = 1.857262;
  const qrBalanceCny = 8.342738;

  const totalSuccess = success.length;
  const impliedCostPerCall = totalSuccess > 0 ? qrUsedCny / totalSuccess : null;
  const impliedCostPerPoint =
    textStats.points + imageStats.points > 0
      ? qrUsedCny / (textStats.points + imageStats.points)
      : null;

  const textOnlyImplied =
    textStats.count > 0 && imageStats.count === 0
      ? qrUsedCny / textStats.count
      : textStats.count > 0
        ? qrUsedCny * (textStats.count / totalSuccess) / textStats.count
        : null;

  console.log(
    JSON.stringify(
      {
        config: {
          textChargePoints: textCharge,
          imageChargePoints: imageCharge,
          registerWelcomePoints: Number(welcomePoints?.configValue ?? 20),
        },
        users,
        usage: {
          successTotal: totalSuccess,
          text: textStats,
          image: imageStats,
          refunded,
          failed,
        },
        balanceFlow: {
          giftRecords: gifts._count,
          giftPointsTotal: gifts._sum.amount ?? 0,
          consumeRecords: consumed._count,
          consumePointsTotal: Math.abs(consumed._sum.amount ?? 0),
        },
        quickRouter: {
          historicalUsedCny: qrUsedCny,
          currentBalanceCny: qrBalanceCny,
        },
        unitEconomics: {
          impliedCnyPerSuccessfulCall: impliedCostPerCall,
          impliedCnyPerPlatformPoint: impliedCostPerPoint,
          impliedCnyPerTextCall: textOnlyImplied,
          impliedCnyPerTextPoint: textCharge > 0 && textOnlyImplied ? textOnlyImplied / textCharge : null,
          welcomeGiftApiCostCny:
            impliedCostPerPoint != null
              ? Number(welcomePoints?.configValue ?? 20) * impliedCostPerPoint
              : null,
        },
        textTokenAverages:
          textStats.count > 0
            ? {
                avgInput: Math.round(textStats.inputTokens / textStats.count),
                avgOutput: Math.round(textStats.outputTokens / textStats.count),
                avgTotal: Math.round(textStats.totalTokens / textStats.count),
                avgMs: textStats.avgResponseMs,
              }
            : null,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
