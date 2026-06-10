import { NextRequest } from "next/server";
import { getSession, requireSession } from "@/lib/auth";
import { AppError } from "@/lib/billing";
import { jsonError, jsonOk } from "@/lib/api-response";
import { isBetaFeedbackEnabled } from "@/features/beta-feedback/config";
import {
  BETA_FEEDBACK_CONTENT_MAX,
  BETA_FEEDBACK_CONTENT_MIN,
  BETA_FEEDBACK_MAX_IMAGES,
} from "@/features/beta-feedback/config";
import {
  createBetaFeedback,
  listPublicBetaFeedback,
} from "@/features/beta-feedback/lib/service";
import type { BetaFeedbackAttachment } from "@/features/beta-feedback/types";

function assertEnabled() {
  if (!isBetaFeedbackEnabled()) {
    throw new AppError("FEATURE_DISABLED", "灰度反馈功能未开启", 404);
  }
}

export async function GET(req: NextRequest) {
  try {
    assertEnabled();
    const session = await getSession();
    requireSession(session);

    const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;
    const data = await listPublicBetaFeedback({ cursor });
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    assertEnabled();
    const session = await getSession();
    const user = requireSession(session);

    const body = (await req.json()) as {
      content?: string;
      attachments?: BetaFeedbackAttachment[];
    };

    const content = body.content?.trim() ?? "";
    if (content.length < BETA_FEEDBACK_CONTENT_MIN) {
      throw new AppError("INVALID_INPUT", `请至少写 ${BETA_FEEDBACK_CONTENT_MIN} 个字`, 400);
    }
    if (content.length > BETA_FEEDBACK_CONTENT_MAX) {
      throw new AppError("INVALID_INPUT", `内容不能超过 ${BETA_FEEDBACK_CONTENT_MAX} 字`, 400);
    }

    const attachments = (body.attachments ?? []).filter((a) => a.kind === "image");
    if (attachments.length > BETA_FEEDBACK_MAX_IMAGES) {
      throw new AppError("INVALID_INPUT", `最多上传 ${BETA_FEEDBACK_MAX_IMAGES} 张截图`, 400);
    }

    const item = await createBetaFeedback({
      userId: user.userId,
      content,
      attachments,
    });

    return jsonOk({
      item: {
        id: item.id,
        publicAlias: item.publicAlias,
        content: item.content,
        attachments,
        status: item.status,
        resolvedAt: null,
        resolvedNote: null,
        rewardPoints: 0,
        rewardTier: null,
        createdAt: item.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
