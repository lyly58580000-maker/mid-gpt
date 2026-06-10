import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";
import { requireUserSession } from "@/lib/api-auth";
import { AppError } from "@/lib/billing";

export async function GET() {
  try {
    const session = await requireUserSession();
    const projects = await prisma.project.findMany({
      where: { userId: session.userId, status: "active" },
      orderBy: { updatedAt: "desc" },
    });
    return jsonOk({ projects });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireUserSession();
    const body = (await req.json()) as {
      name?: string;
      type?: string;
      summary?: string;
      currentStage?: string;
      constraints?: string;
    };
    if (!body.name?.trim()) throw new AppError("INVALID_INPUT", "请输入项目名称", 400);

    const project = await prisma.project.create({
      data: {
        userId: session.userId,
        name: body.name.trim(),
        type: body.type?.trim(),
        summary: body.summary?.trim(),
        currentStage: body.currentStage?.trim(),
        constraints: body.constraints?.trim(),
      },
    });
    return jsonOk({ project });
  } catch (error) {
    return jsonError(error);
  }
}
