import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectIntent } from "@/lib/ai/intent";
import { buildChatMessages, generateTextReply } from "@/lib/ai/text-provider";
import { parseAttachments, serializeAttachments, type MessageAttachment } from "@/lib/attachments";
import { generateImage } from "@/lib/ai/image-provider";
import {
  AppError,
  preDeductPoints,
  refundPoints,
  createUsageRecord,
} from "@/lib/billing";
import { getChargePoints, getConfigBool } from "@/lib/system-config";
import { jsonError } from "@/lib/api-response";

export async function POST(req: Request) {
  const started = Date.now();
  let userId = "";
  let costPoints = 0;
  let usageRecordId: string | undefined;

  try {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");
    userId = session.userId;

    if (await getConfigBool("maintenance_mode")) {
      throw new AppError("MAINTENANCE", "系统维护中，请稍后再试", 503);
    }

    const body = (await req.json()) as {
      message?: string;
      conversationId?: string | null;
      groupId?: string;
      truncateFromMessageId?: string;
      attachments?: MessageAttachment[];
    };

    const message = body.message?.trim() ?? "";
    const attachments = body.attachments ?? [];
    const hasImageAttachment = attachments.some((a) => a.kind === "image");

    if (!message && attachments.length === 0) {
      throw new AppError("INVALID_INPUT", "请输入文字或上传附件");
    }

    const intent = detectIntent(message);
    const isImage = intent === "image" && !hasImageAttachment && attachments.length === 0;

    if (isImage && !(await getConfigBool("image_enabled", true))) {
      throw new AppError("IMAGE_DISABLED", "图片生成功能已关闭", 403);
    }
    if (!isImage && !(await getConfigBool("text_enabled", true))) {
      throw new AppError("TEXT_DISABLED", "文本对话功能已关闭", 403);
    }

    costPoints = await getChargePoints(isImage ? "image" : "text");
    await preDeductPoints(userId, costPoints, isImage ? "生图预扣" : "文本预扣");

    let conversationId = body.conversationId ?? null;

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
        data: { userId, groupId, title },
      });
      conversationId = conversation.id;
    } else {
      const exists = await prisma.conversation.findFirst({
        where: { id: conversationId, userId, status: "active" },
      });
      if (!exists) throw new AppError("NOT_FOUND", "会话不存在", 404);

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

    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        userId,
        role: "user",
        contentType: "text",
        content: message || (hasImageAttachment ? "请分析我上传的图片" : "请查看我上传的文档"),
        attachments: serializeAttachments(attachments),
      },
    });

    if (isImage) {
      try {
        const { url, model } = await generateImage(message);
        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            userId,
            role: "assistant",
            contentType: "image",
            content: message,
            imageUrl: url,
          },
        });

        const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            updatedAt: new Date(),
            ...(conv?.title === "新对话"
              ? { title: message.length > 20 ? `${message.slice(0, 20)}...` : message }
              : {}),
          },
        });

        const usage = await createUsageRecord({
          userId,
          conversationId,
          messageId: assistantMessage.id,
          usageType: "image",
          modelName: model,
          costPoints,
          status: "success",
          responseMs: Date.now() - started,
          estimatedCost: costPoints * 0.1,
        });
        usageRecordId = usage.id;

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
            content: message,
            imageUrl: url,
          },
          balanceDeducted: costPoints,
        });
      } catch (err) {
        await refundPoints(userId, costPoints, usageRecordId);
        await createUsageRecord({
          userId,
          conversationId,
          usageType: "image",
          modelName: process.env.IMAGE_MODEL_NAME ?? "gpt-image-2",
          costPoints,
          status: "refunded",
          errorMessage: err instanceof Error ? err.message : "生图失败",
          responseMs: Date.now() - started,
        });
        throw err;
      }
    }

    const history = await prisma.message.findMany({
      where: { conversationId, role: { in: ["user", "assistant"] }, contentType: "text" },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const chatMessages = await buildChatMessages(
      history
        .filter((m) => m.id !== userMessage.id)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          attachments: m.attachments,
        })),
      message || userMessage.content,
      attachments,
    );

    let fullText = "";
    let modelName = process.env.TEXT_MODEL_NAME ?? "gpt-5.5";
    let usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined;

    try {
      const result = await generateTextReply(chatMessages);
      fullText = result.text;
      usage = result.usage;
      modelName = result.modelName;
    } catch (err) {
      await refundPoints(userId, costPoints);
      await createUsageRecord({
        userId,
        conversationId,
        usageType: "text",
        modelName,
        costPoints,
        status: "refunded",
        errorMessage: err instanceof Error ? err.message : "文本生成失败",
        responseMs: Date.now() - started,
      });
      throw err;
    }

    if (!fullText.trim()) {
      await refundPoints(userId, costPoints);
      throw new AppError(
        "AI_EMPTY",
        "API 未返回内容，请检查 QuickRouter 余额与模型 gpt-5.5 是否可用",
        502,
      );
    }

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        userId,
        role: "assistant",
        contentType: "text",
        content: fullText,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await createUsageRecord({
      userId,
      conversationId,
      messageId: assistantMessage.id,
      usageType: "text",
      modelName,
      costPoints,
      status: "success",
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      totalTokens: usage?.totalTokens,
      responseMs: Date.now() - started,
    });

    return Response.json({
      type: "text",
      conversationId,
      userMessage: {
        id: userMessage.id,
        role: "user",
        contentType: "text",
        content: userMessage.content,
        attachments: parseAttachments(userMessage.attachments),
      },
      message: {
        id: assistantMessage.id,
        role: "assistant",
        contentType: "text",
        content: fullText,
      },
    });
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
    if (msg.includes("quota") || msg.includes("余额不足")) {
      return jsonError(
        new AppError("OPENAI_QUOTA", "API 账户余额不足，请登录 QuickRouter 控制台充值", 502),
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
