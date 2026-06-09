import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "text";

    const records = await prisma.usageRecord.findMany({
      where: { usageType: type === "image" ? "image" : "text" },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { email: true, nickname: true } } },
    });

    return jsonOk({ records });
  } catch (error) {
    return jsonError(error);
  }
}
