import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";
import { requireUserSession } from "@/lib/api-auth";
import { AppError } from "@/lib/billing";

export async function GET() {
  try {
    const session = await requireUserSession();
    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.userId },
    });
    return jsonOk({ profile });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireUserSession();
    const body = (await req.json()) as {
      identitySummary?: string;
      preferenceSummary?: string;
      commonTasks?: string;
      dislikedStyles?: string;
      outputPreference?: string;
      expertiseLevel?: string;
      interactionStyle?: string;
    };

    const profile = await prisma.userProfile.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId, ...body },
      update: body,
    });
    return jsonOk({ profile });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE() {
  try {
    const session = await requireUserSession();
    await prisma.userProfile.deleteMany({ where: { userId: session.userId } });
    return jsonOk({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
