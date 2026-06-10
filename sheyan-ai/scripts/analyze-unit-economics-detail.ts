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

function pct(nums: number[], p: number) {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function main() {
  const rows = await prisma.usageRecord.findMany({
    where: { status: "success", usageType: "text" },
    select: { totalTokens: true, inputTokens: true, outputTokens: true, responseMs: true, costPoints: true },
  });

  const totals = rows.map((r) => r.totalTokens ?? 0);
  const inputs = rows.map((r) => r.inputTokens ?? 0);
  const outputs = rows.map((r) => r.outputTokens ?? 0);
  const ms = rows.map((r) => r.responseMs ?? 0);

  const qrUsed = 1.857262;
  const textShare = rows.length / 19; // 18/19 of successful calls are text
  const textCost = qrUsed * (18 / 23); // allocate by point weight text18 image5

  console.log(
    JSON.stringify(
      {
        textCalls: rows.length,
        tokenDistribution: {
          total: { min: Math.min(...totals), p50: pct(totals, 50), p90: pct(totals, 90), max: Math.max(...totals) },
          input: { min: Math.min(...inputs), p50: pct(inputs, 50), p90: pct(inputs, 90), max: Math.max(...inputs) },
          output: { min: Math.min(...outputs), p50: pct(outputs, 50), p90: pct(outputs, 90), max: Math.max(...outputs) },
        },
        latencyMs: { p50: pct(ms, 50), p90: pct(ms, 90), max: Math.max(...ms) },
        estimatedTextApiCostCny: {
          total: textCost,
          perCall: textCost / rows.length,
          perPoint: textCost / rows.reduce((s, r) => s + r.costPoints, 0),
          per1kTokens: textCost / (totals.reduce((a, b) => a + b, 0) / 1000),
        },
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main();
