import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";
import { requireUserSession } from "@/lib/api-auth";
import { AppError } from "@/lib/billing";

type Params = { params: Promise<{ id: string }> };

async function getOwnedProject(userId: string, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, userId, status: "active" },
  });
  if (!project) throw new AppError("NOT_FOUND", "项目不存在", 404);
  return project;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireUserSession();
    const { id } = await params;
    const project = await getOwnedProject(session.userId, id);
    const memories = await prisma.projectMemory.findMany({
      where: { userId: session.userId, projectId: id },
      orderBy: { updatedAt: "desc" },
    });
    return jsonOk({ project, memories });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const session = await requireUserSession();
    const { id } = await params;
    await getOwnedProject(session.userId, id);
    const body = (await req.json()) as {
      name?: string;
      type?: string;
      summary?: string;
      currentStage?: string;
      keyDecisions?: string;
      constraints?: string;
    };

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.type !== undefined ? { type: body.type?.trim() } : {}),
        ...(body.summary !== undefined ? { summary: body.summary?.trim() } : {}),
        ...(body.currentStage !== undefined ? { currentStage: body.currentStage?.trim() } : {}),
        ...(body.keyDecisions !== undefined ? { keyDecisions: body.keyDecisions?.trim() } : {}),
        ...(body.constraints !== undefined ? { constraints: body.constraints?.trim() } : {}),
      },
    });
    return jsonOk({ project });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireUserSession();
    const { id } = await params;
    await getOwnedProject(session.userId, id);
    await prisma.project.update({
      where: { id },
      data: { status: "archived" },
    });
    return jsonOk({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
