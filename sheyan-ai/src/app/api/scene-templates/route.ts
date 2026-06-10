import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";
import { requireUserSession } from "@/lib/api-auth";
import { SCENE_TEMPLATES_SEED } from "@/lib/ai/workspace-seed-data";

export async function GET() {
  try {
    await requireUserSession();
    let templates = await prisma.sceneTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    if (templates.length === 0) {
      templates = await Promise.all(
        SCENE_TEMPLATES_SEED.map((t) =>
          prisma.sceneTemplate.upsert({
            where: { slug: t.slug },
            update: {},
            create: t,
          }),
        ),
      );
    }
    return jsonOk({ templates });
  } catch (error) {
    return jsonError(error);
  }
}
