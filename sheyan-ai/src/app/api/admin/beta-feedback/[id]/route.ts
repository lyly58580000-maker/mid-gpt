import { getSession, requireAdmin } from "@/lib/auth";
import { AppError } from "@/lib/billing";
import { jsonError, jsonOk } from "@/lib/api-response";
import {
  BETA_FEEDBACK_REWARD_TIERS,
  type BetaFeedbackRewardTierKey,
} from "@/features/beta-feedback/config";
import {
  reopenBetaFeedback,
  resolveBetaFeedback,
} from "@/features/beta-feedback/lib/service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const { id } = await params;
    const body = (await req.json()) as {
      action?: "resolve" | "reopen";
      rewardTier?: string;
      resolvedNote?: string;
    };

    if (body.action === "reopen") {
      const item = await reopenBetaFeedback(id);
      return jsonOk({ item });
    }

    if (body.action !== "resolve") {
      throw new AppError("INVALID_INPUT", "未知操作", 400);
    }

    const tierKey = body.rewardTier as BetaFeedbackRewardTierKey;
    if (!tierKey || !(tierKey in BETA_FEEDBACK_REWARD_TIERS)) {
      throw new AppError("INVALID_INPUT", "请选择积分档位", 400);
    }

    const item = await resolveBetaFeedback({
      id,
      rewardTier: tierKey,
      resolvedNote: body.resolvedNote,
    });

    return jsonOk({ item });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return jsonError(new AppError("NOT_FOUND", "反馈不存在", 404));
      }
      if (error.message === "ALREADY_RESOLVED") {
        return jsonError(new AppError("ALREADY_RESOLVED", "该反馈已标记解决", 400));
      }
    }
    return jsonError(error);
  }
}
