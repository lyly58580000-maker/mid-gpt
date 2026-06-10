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

    const statusLabel = (status: string) => {
      if (status === "success") return "成功";
      if (status === "pending") return "进行中";
      if (status === "refunded") return "已退款";
      return "失败";
    };

    return jsonOk({
      records: records.map((r) => ({
        id: r.id,
        time: r.createdAt.toISOString().replace("T", " ").slice(0, 16),
        type: r.usageType === "text" ? "文本对话" : "图片生成",
        cost: `-${r.costPoints}`,
        status: statusLabel(r.status),
        duration: r.responseMs != null ? `${(r.responseMs / 1000).toFixed(1)}s` : r.status === "pending" ? "—" : "",
        error: r.errorMessage ?? "",
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
