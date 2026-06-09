import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const records = await prisma.usageRecord.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return jsonOk({
      records: records.map((r) => ({
        id: r.id,
        time: r.createdAt.toISOString().replace("T", " ").slice(0, 16),
        type: r.usageType === "text" ? "文本对话" : "图片生成",
        cost: `-${r.costPoints}`,
        status:
          r.status === "success" ? "成功" : r.status === "refunded" ? "已退款" : "失败",
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
