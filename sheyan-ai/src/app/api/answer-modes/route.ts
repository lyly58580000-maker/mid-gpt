import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";
import { requireUserSession } from "@/lib/api-auth";
import { ANSWER_MODES_SEED } from "@/lib/ai/workspace-seed-data";

export async function GET() {
  try {
    await requireUserSession();
    let modes = await prisma.answerMode.findMany({ orderBy: { createdAt: "asc" } });
    if (modes.length === 0) {
      modes = await Promise.all(
        ANSWER_MODES_SEED.map((m) =>
          prisma.answerMode.upsert({
            where: { slug: m.slug },
            update: {},
            create: m,
          }),
        ),
      );
    }
    return jsonOk({ modes });
  } catch (error) {
    return jsonError(error);
  }
}
