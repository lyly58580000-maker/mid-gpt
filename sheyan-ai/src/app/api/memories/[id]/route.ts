import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";
import { requireUserSession } from "@/lib/api-auth";
import { AppError } from "@/lib/billing";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const session = await requireUserSession();
    const { id } = await params;
    const existing = await prisma.projectMemory.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) throw new AppError("NOT_FOUND", "记忆不存在", 404);

    const body = (await req.json()) as { content?: string; memoryType?: string; confidence?: number };
    const memory = await prisma.projectMemory.update({
      where: { id },
      data: {
        ...(body.content !== undefined ? { content: body.content.trim() } : {}),
        ...(body.memoryType !== undefined ? { memoryType: body.memoryType.trim() } : {}),
        ...(body.confidence !== undefined ? { confidence: body.confidence } : {}),
      },
    });
    return jsonOk({ memory });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireUserSession();
    const { id } = await params;
    const result = await prisma.projectMemory.deleteMany({
      where: { id, userId: session.userId },
    });
    if (result.count === 0) throw new AppError("NOT_FOUND", "记忆不存在", 404);
    return jsonOk({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
