import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";
import { requireUserSession } from "@/lib/api-auth";
import { AppError } from "@/lib/billing";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireUserSession();
    const { id } = await params;
    const project = await prisma.project.findFirst({
      where: { id, userId: session.userId, status: "active" },
    });
    if (!project) throw new AppError("NOT_FOUND", "项目不存在", 404);

    const memories = await prisma.projectMemory.findMany({
      where: { userId: session.userId, projectId: id },
      orderBy: { updatedAt: "desc" },
    });
    return jsonOk({ memories });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireUserSession();
    const { id } = await params;
    const project = await prisma.project.findFirst({
      where: { id, userId: session.userId, status: "active" },
    });
    if (!project) throw new AppError("NOT_FOUND", "项目不存在", 404);

    const body = (await req.json()) as {
      memoryType?: string;
      content?: string;
      confidence?: number;
    };
    if (!body.content?.trim()) throw new AppError("INVALID_INPUT", "请输入记忆内容", 400);

    const memory = await prisma.projectMemory.create({
      data: {
        userId: session.userId,
        projectId: id,
        memoryType: body.memoryType?.trim() || "note",
        content: body.content.trim(),
        confidence: body.confidence ?? 0.9,
      },
    });
    return jsonOk({ memory });
  } catch (error) {
    return jsonError(error);
  }
}
