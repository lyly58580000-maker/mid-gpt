import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const { id } = await params;
    const { name } = (await req.json()) as { name?: string };

    const group = await prisma.chatGroup.findFirst({
      where: { id, userId: session.userId, isDefault: false },
    });

    if (!group) return jsonError({ code: "NOT_FOUND", message: "分组不存在或不可编辑", status: 404 });
    if (!name?.trim()) return jsonError({ code: "INVALID_INPUT", message: "名称不能为空", status: 400 });

    const updated = await prisma.chatGroup.update({
      where: { id },
      data: { name: name.trim() },
    });

    return jsonOk({ group: updated });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const { id } = await params;
    const group = await prisma.chatGroup.findFirst({
      where: { id, userId: session.userId, isDefault: false },
    });

    if (!group) return jsonError({ code: "NOT_FOUND", message: "分组不存在或不可删除", status: 404 });

    const defaultGroup = await prisma.chatGroup.findFirst({
      where: { userId: session.userId, isDefault: true },
    });

    if (!defaultGroup) return jsonError({ code: "NO_DEFAULT_GROUP", message: "默认分组不存在", status: 500 });

    await prisma.$transaction([
      prisma.conversation.updateMany({
        where: { groupId: id },
        data: { groupId: defaultGroup.id },
      }),
      prisma.chatGroup.update({ where: { id }, data: { status: "deleted" } }),
    ]);

    return jsonOk({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
