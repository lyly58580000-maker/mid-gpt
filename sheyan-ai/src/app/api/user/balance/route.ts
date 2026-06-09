import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { balance: true },
    });

    return jsonOk({ balance: user?.balance ?? 0 });
  } catch (error) {
    return jsonError(error);
  }
}
