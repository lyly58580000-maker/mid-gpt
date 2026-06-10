import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseAttachments } from "@/lib/attachments";
import { jsonOk, jsonError } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const { id } = await params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: session.userId, status: "active" },
    });

    if (!conversation) return jsonError({ code: "NOT_FOUND", message: "会话不存在", status: 404 });

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });

    return jsonOk({
      conversation,
      messages: messages.map((m) => ({
        ...m,
        attachments: parseAttachments(m.attachments),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const { id } = await params;
    const body = (await req.json()) as {
      title?: string;
      groupId?: string;
      projectId?: string | null;
      answerModeSlug?: string;
      sceneTemplateSlug?: string | null;
    };

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: session.userId, status: "active" },
    });

    if (!conversation) return jsonError({ code: "NOT_FOUND", message: "会话不存在", status: 404 });

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        ...(body.title ? { title: body.title.trim() } : {}),
        ...(body.groupId ? { groupId: body.groupId } : {}),
        ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
        ...(body.answerModeSlug ? { answerModeSlug: body.answerModeSlug } : {}),
        ...(body.sceneTemplateSlug !== undefined ? { sceneTemplateSlug: body.sceneTemplateSlug } : {}),
        updatedAt: new Date(),
      },
    });

    return jsonOk({ conversation: updated });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const { id } = await params;
    await prisma.conversation.updateMany({
      where: { id, userId: session.userId },
      data: { status: "deleted" },
    });

    return jsonOk({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
