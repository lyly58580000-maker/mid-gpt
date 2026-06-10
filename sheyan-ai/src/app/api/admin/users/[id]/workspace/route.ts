import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";
import { AppError } from "@/lib/billing";

type Params = { params: Promise<{ id: string }> };

/** 管理员只读查看用户工作台数据（画像 / 项目 / 记忆），用于客服与运营 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const user = await prisma.user.findFirst({
      where: { id, role: "USER" },
      select: {
        id: true,
        email: true,
        nickname: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    if (!user) throw new AppError("NOT_FOUND", "用户不存在", 404);

    const [profile, projects] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: id } }),
      prisma.project.findMany({
        where: { userId: id, status: "active" },
        orderBy: { updatedAt: "desc" },
        include: {
          memories: {
            orderBy: { updatedAt: "desc" },
            take: 30,
          },
          _count: { select: { conversations: true } },
        },
      }),
    ]);

    return jsonOk({
      user,
      profile,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        summary: p.summary,
        currentStage: p.currentStage,
        keyDecisions: p.keyDecisions,
        constraints: p.constraints,
        updatedAt: p.updatedAt,
        conversationCount: p._count.conversations,
        memories: p.memories,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
