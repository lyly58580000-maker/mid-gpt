import { NextRequest } from "next/server";
import { BetaFeedbackStatus } from "@prisma/client";
import { getSession, requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import {
  getBetaFeedbackStats,
  listAdminBetaFeedback,
} from "@/features/beta-feedback/lib/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const statusParam = req.nextUrl.searchParams.get("status");
    const status =
      statusParam === "open" || statusParam === "resolved"
        ? (statusParam as BetaFeedbackStatus)
        : undefined;

    const [items, statsRows] = await Promise.all([
      listAdminBetaFeedback(status),
      getBetaFeedbackStats(),
    ]);

    const stats = {
      open: statsRows.find((s) => s.status === "open")?._count._all ?? 0,
      resolved: statsRows.find((s) => s.status === "resolved")?._count._all ?? 0,
    };

    return jsonOk({ items, stats });
  } catch (error) {
    return jsonError(error);
  }
}
