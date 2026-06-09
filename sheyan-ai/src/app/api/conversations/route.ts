import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const url = new URL(req.url);
    const groupId = url.searchParams.get("groupId") ?? "all";

    const where =
      groupId === "all"
        ? { userId: session.userId, status: "active" }
        : { userId: session.userId, groupId, status: "active" };

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, groupId: true, updatedAt: true, createdAt: true },
    });

    return jsonOk({ conversations });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const body = (await req.json()) as { groupId?: string };
    let groupId = body.groupId;

    if (!groupId || groupId === "all") {
      const defaultGroup = await prisma.chatGroup.findFirst({
        where: { userId: session.userId, isDefault: true },
      });
      if (!defaultGroup) return jsonError({ code: "NO_DEFAULT_GROUP", message: "默认分组不存在", status: 500 });
      groupId = defaultGroup.id;
    }

    const conversation = await prisma.conversation.create({
      data: { userId: session.userId, groupId, title: "新对话" },
    });

    return jsonOk({ conversation });
  } catch (error) {
    return jsonError(error);
  }
}
