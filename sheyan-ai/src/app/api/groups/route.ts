import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return jsonOk({ groups: [] });

    const groups = await prisma.chatGroup.findMany({
      where: { userId: session.userId, status: "active" },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { conversations: { where: { status: "active" } } } },
      },
    });

    const allCount = await prisma.conversation.count({
      where: { userId: session.userId, status: "active" },
    });

    return jsonOk({
      groups: [
        { id: "all", name: "全部聊天", count: allCount, isSystem: true, isDefault: false },
        ...groups.map((g) => ({
          id: g.id,
          name: g.name,
          count: g._count.conversations,
          isSystem: g.isDefault,
          isDefault: g.isDefault,
        })),
      ],
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const { name } = (await req.json()) as { name?: string };
    if (!name?.trim()) {
      return jsonError({ code: "INVALID_INPUT", message: "分组名称不能为空", status: 400 });
    }

    const maxSort = await prisma.chatGroup.aggregate({
      where: { userId: session.userId },
      _max: { sortOrder: true },
    });

    const group = await prisma.chatGroup.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });

    return jsonOk({ group });
  } catch (error) {
    return jsonError(error);
  }
}
