import { getSession } from "@/lib/auth";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { resolveImageRequest } from "@/lib/ai/image-intent";
import { createTextStream, mapApiError } from "@/lib/ai/text-provider";
import { buildPromptContext } from "@/lib/ai/prompt-context";
import { applyMemoryUpdates } from "@/lib/ai/memory-extractor";
import { parseAttachments, serializeAttachments, type MessageAttachment } from "@/lib/attachments";
import { maskPreviewAttachment } from "@/lib/attachments-preview.server";
import { generateImage } from "@/lib/ai/image-provider";
import { logImage } from "@/lib/ai/image-logger";
import {
  AppError,
  preDeductPoints,
  refundPoints,
  createUsageRecord,
} from "@/lib/billing";
import { getChargePoints, getConfigBool } from "@/lib/system-config";
import { jsonError } from "@/lib/api-response";
import { fetchQuickRouterQuota } from "@/lib/quickrouter-quota";
import { estimateApiCostCny } from "@/lib/api-cost";

/** 香港节点，靠近 QuickRouter / 国内访问；生图需 Pro 计划 maxDuration>60 */
export const preferredRegion = ["hkg1", "sin1"];
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const started = Date.now();
  let userId = "";
  let costPoints = 0;
  let usageRecordId: string | undefined;

  try {
    const session = await withPrismaRetry(() => getSession());
    if (!session) throw new Error("UNAUTHORIZED");
    userId = session.userId;

    if (await getConfigBool("maintenance_mode")) {
      throw new AppError("MAINTENANCE", "系统维护中，请稍后再试", 503);
    }

    const body = (await req.json()) as {
      message?: string;
      conversationId?: string | null;
      projectId?: string | null;
      groupId?: string;
      truncateFromMessageId?: string;
      attachments?: MessageAttachment[];
      answerMode?: string | null;
      sceneTemplateId?: string | null;
      useMemory?: boolean;
      imageEdit?: {
        sourceImageUrl?: string;
        maskDataUrl?: string | null;
        maskPreviewDataUrl?: string | null;
        prompt?: string;
      };
    };

    const imageEditBody = body.imageEdit;
    const imageEditPrompt = imageEditBody?.prompt?.trim() ?? "";
    const imageEditSource = imageEditBody?.sourceImageUrl?.trim() ?? "";
    const isImageEditRequest = Boolean(imageEditSource && imageEditPrompt);

    const message = isImageEditRequest ? imageEditPrompt : (body.message?.trim() ?? "");
    const attachments = body.attachments ?? [];
    const hasImageAttachment = attachments.some((a) => a.kind === "image");

    if (!message && attachments.length === 0 && !isImageEditRequest) {
      throw new AppError("INVALID_INPUT", "请输入文字或上传附件");
    }

    let historyForIntent: {
      role: string;
      contentType: string;
      imageUrl: string | null;
      attachments: string | null;
    }[] = [];

    if (body.conversationId) {
      historyForIntent = await prisma.message.findMany({
        where: { conversationId: body.conversationId, role: { in: ["user", "assistant"] } },
        orderBy: { createdAt: "asc" },
        take: 30,
        select: {
          role: true,
          contentType: true,
          imageUrl: true,
          attachments: true,
        },
      });
    }

    let imageRequest = resolveImageRequest({
      message,
      attachments,
      history: historyForIntent.map((m) => ({
        role: m.role as "user" | "assistant",
        contentType: m.contentType as "text" | "image",
        imageUrl: m.imageUrl,
        attachments: m.attachments,
      })),
    });

    if (isImageEditRequest) {
      imageRequest = {
        shouldGenerate: true,
        prompt: imageEditPrompt,
        referenceImageUrls: [imageEditSource],
        maskDataUrl: imageEditBody?.maskDataUrl ?? undefined,
      };
    }

    const isImage = imageRequest.shouldGenerate;

    if (isImage && !(await getConfigBool("image_enabled", true))) {
      throw new AppError("IMAGE_DISABLED", "图片生成功能已关闭", 403);
    }
    if (!isImage && !(await getConfigBool("text_enabled", true))) {
      throw new AppError("TEXT_DISABLED", "文本对话功能已关闭", 403);
    }

    costPoints = await getChargePoints(isImage ? "image" : "text");
    await preDeductPoints(userId, costPoints, isImage ? "生图预扣" : "文本预扣");

    if (!isImage) {
      const apiQuota = await fetchQuickRouterQuota();
      if (
        apiQuota.available &&
        !apiQuota.unlimited &&
        apiQuota.balance != null &&
        apiQuota.balance <= 0
      ) {
        await refundPoints(userId, costPoints);
        throw new AppError(
          "OPENAI_QUOTA",
          "QuickRouter API 额度已用完，请登录 quickrouter.ai 控制台充值",
          502,
        );
      }
    }

    let conversationId = body.conversationId ?? null;
    const answerModeSlug = body.answerMode?.trim() || "quick";
    const sceneTemplateSlug = body.sceneTemplateId?.trim() || null;
    const useMemory = body.useMemory !== false;
    let projectId = body.projectId ?? null;

    if (projectId) {
      const owned = await prisma.project.findFirst({
        where: { id: projectId, userId, status: "active" },
      });
      if (!owned) projectId = null;
    }

    if (!conversationId) {
      let groupId = body.groupId;
      if (!groupId || groupId === "all") {
        const defaultGroup = await prisma.chatGroup.findFirst({
          where: { userId, isDefault: true },
        });
        groupId = defaultGroup?.id;
      }
      if (!groupId) throw new AppError("NO_GROUP", "未找到可用分组", 500);

      const titleSource = message || attachments[0]?.name || "新对话";
      const title = titleSource.length > 20 ? `${titleSource.slice(0, 20)}...` : titleSource;
      const conversation = await prisma.conversation.create({
        data: {
          userId,
          groupId,
          title,
          projectId,
          answerModeSlug,
          sceneTemplateSlug,
          useMemory,
        },
      });
      conversationId = conversation.id;
    } else {
      const exists = await prisma.conversation.findFirst({
        where: { id: conversationId, userId, status: "active" },
      });
      if (!exists) throw new AppError("NOT_FOUND", "会话不存在", 404);

      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          projectId,
          answerModeSlug,
          sceneTemplateSlug,
          useMemory,
        },
      });

      if (body.truncateFromMessageId) {
        const target = await prisma.message.findFirst({
          where: { id: body.truncateFromMessageId, conversationId, userId },
        });
        if (target) {
          await prisma.message.deleteMany({
            where: {
              conversationId,
              createdAt: { gte: target.createdAt },
            },
          });
        }
      }
    }

    let userAttachments: MessageAttachment[] = [...attachments];
    if (isImageEditRequest && imageEditBody?.maskPreviewDataUrl) {
      try {
        const preview = await maskPreviewAttachment(imageEditBody.maskPreviewDataUrl, userId);
        userAttachments = [preview, ...userAttachments];
      } catch (err) {
        console.warn("mask preview save failed:", err);
      }
    }

    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        userId,
        role: "user",
        contentType: "text",
        content: message || (hasImageAttachment ? "请分析我上传的图片" : "请查看我上传的文档"),
        attachments: serializeAttachments(userAttachments),
      },
    });

    if (isImage) {
      const imagePrompt =
        imageRequest.prompt ||
        message ||
        (imageRequest.referenceImageUrls.length > 0
          ? "根据参考图生成新图片，保持构图与主体"
          : "生成一张图片");

      const pendingUsage = await createUsageRecord({
        userId,
        conversationId,
        usageType: "image",
        modelName: process.env.IMAGE_MODEL_NAME ?? "gpt-image-2",
        costPoints,
        status: "pending",
      });
      usageRecordId = pendingUsage.id;

      logImage("chat_start", {
        conversationId,
        userId,
        refs: imageRequest.referenceImageUrls.length,
        usageRecordId: pendingUsage.id,
      });

      try {
        const { url, model } = await generateImage({
          prompt: imagePrompt,
          referenceImageUrls: imageRequest.referenceImageUrls,
          maskDataUrl: imageRequest.maskDataUrl,
          abortSignal: req.signal,
        });
        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            userId,
            role: "assistant",
            contentType: "image",
            content: imagePrompt,
            imageUrl: url,
          },
        });

        const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            updatedAt: new Date(),
            ...(conv?.title === "新对话"
              ? {
                  title:
                    imagePrompt.length > 20 ? `${imagePrompt.slice(0, 20)}...` : imagePrompt,
                }
              : {}),
          },
        });

        const imageApiCost = await estimateApiCostCny({ usageType: "image" });
        const responseMs = Date.now() - started;
        await prisma.usageRecord.update({
          where: { id: pendingUsage.id },
          data: {
            messageId: assistantMessage.id,
            modelName: model,
            status: "success",
            responseMs,
            estimatedCost: imageApiCost,
          },
        });

        logImage("chat_done", { conversationId, responseMs, usageRecordId: pendingUsage.id });

        return Response.json({
          type: "image",
          conversationId,
          userMessage: {
            id: userMessage.id,
            role: "user",
            contentType: "text",
            content: message,
          },
          message: {
            id: assistantMessage.id,
            role: "assistant",
            contentType: "image",
            content: imagePrompt,
            imageUrl: url,
          },
          balanceDeducted: costPoints,
        });
      } catch (err) {
        const responseMs = Date.now() - started;
        const errorMessage = err instanceof Error ? err.message : "生图失败";
        await refundPoints(userId, costPoints, usageRecordId);
        await prisma.usageRecord.update({
          where: { id: pendingUsage.id },
          data: {
            status: "refunded",
            errorMessage,
            responseMs,
          },
        });
        logImage("chat_failed", {
          conversationId,
          responseMs,
          usageRecordId: pendingUsage.id,
          error: errorMessage.slice(0, 200),
        });
        throw err;
      }
    }

    const history = await prisma.message.findMany({
      where: { conversationId, role: { in: ["user", "assistant"] } },
      orderBy: { createdAt: "asc" },
      take: 30,
    });

    const { messages: chatMessages, meta: promptMeta } = await buildPromptContext({
      userId,
      conversationId,
      projectId,
      answerModeSlug,
      sceneTemplateSlug,
      useMemory,
      userMessage: message || userMessage.content,
      history: history
        .filter((m) => m.id !== userMessage.id)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          contentType: m.contentType as "text" | "image",
          imageUrl: m.imageUrl,
          attachments: m.attachments,
        })),
      attachments,
    });

    let streamModelName = process.env.TEXT_MODEL_NAME ?? "gpt-5.5";

    try {
      const { result, modelName } = createTextStream(chatMessages, {
        abortSignal: req.signal,
        onFinish: async ({ text, usage }) => {
          if (!text.trim()) {
            await refundPoints(userId, costPoints);
            await createUsageRecord({
              userId,
              conversationId,
              usageType: "text",
              modelName: streamModelName,
              costPoints,
              status: "refunded",
              errorMessage: "API 未返回内容",
              responseMs: Date.now() - started,
            });
            return;
          }

          const assistantMessage = await prisma.message.create({
            data: {
              conversationId,
              userId,
              role: "assistant",
              contentType: "text",
              content: text,
            },
          });

          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });

          const textApiCost = await estimateApiCostCny({
            usageType: "text",
            totalTokens: usage?.totalTokens,
          });
          await createUsageRecord({
            userId,
            conversationId,
            messageId: assistantMessage.id,
            usageType: "text",
            modelName: streamModelName,
            costPoints,
            status: "success",
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
            totalTokens: usage?.totalTokens,
            estimatedCost: textApiCost,
            responseMs: Date.now() - started,
          });

          try {
            await applyMemoryUpdates({
              userId,
              conversationId,
              projectId,
              userMessage: message || userMessage.content,
              assistantReply: text,
            });
          } catch {
            /* 记忆更新失败不影响主流程 */
          }
        },
      });
      streamModelName = modelName;

      const contextHeader = Buffer.from(
        JSON.stringify({
          answerMode: promptMeta.answerModeName,
          usedProfile: promptMeta.usedProfile,
          usedProjectMemory: promptMeta.usedProjectMemory,
          usedConversationSummary: promptMeta.usedConversationSummary,
          usedSceneTemplate: promptMeta.usedSceneTemplate,
          riskDetected: promptMeta.riskDetected,
        }),
        "utf8",
      ).toString("base64");

      return result.toTextStreamResponse({
        headers: {
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          "X-Conversation-Id": conversationId,
          "X-User-Message-Id": userMessage.id,
          "X-Prompt-Context": contextHeader,
        },
      });
    } catch (err) {
      await refundPoints(userId, costPoints);
      await createUsageRecord({
        userId,
        conversationId,
        usageType: "text",
        modelName: streamModelName,
        costPoints,
        status: "refunded",
        errorMessage: err instanceof Error ? mapApiError(err).message : "文本生成失败",
        responseMs: Date.now() - started,
      });
      throw mapApiError(err);
    }
  } catch (error) {
    if (userId && costPoints > 0 && error instanceof AppError && error.code !== "INSUFFICIENT_BALANCE") {
      try {
        await refundPoints(userId, costPoints);
      } catch {
        /* ignore */
      }
    }
    if (error instanceof AppError) return jsonError(error);
    const msg = error instanceof Error ? error.message : "服务器错误";
    if (msg.includes("quota") || msg.includes("QuickRouter") || msg.includes("余额不足")) {
      return jsonError(
        new AppError("OPENAI_QUOTA", "QuickRouter API 额度不足，请登录 quickrouter.ai 控制台充值", 502),
      );
    }
    if (msg.includes("401") || msg.includes("Incorrect API key")) {
      return jsonError(new AppError("API_KEY_INVALID", "API Key 无效，请检查 .env.local 中的 QuickRouter Key", 502));
    }
    if (msg.includes("429") || msg.includes("负载已饱和")) {
      return jsonError(
        new AppError(
          "RATE_LIMIT",
          "生图服务当前繁忙（QuickRouter 上游负载饱和），请稍后再试",
          503,
        ),
      );
    }
    if (msg.includes("ENOTFOUND") || msg.includes("fetch failed") || msg.includes("Connection")) {
      return jsonError(new AppError("NETWORK_ERROR", "无法连接 QuickRouter API，请检查 TEXT_API_BASE_URL 或网络", 502));
    }
    return jsonError(new AppError("CHAT_FAILED", msg, 500));
  }
}
