import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import { parseAttachments, type MessageAttachment, type ModelContentPart } from "@/lib/attachments";
import { buildModelContentParts } from "@/lib/attachments.server";

import { BASE_SYSTEM_PROMPT } from "@/lib/ai/base-system-prompt";

/** @deprecated 使用 buildPromptContext 动态组装 */
export const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;

const IMAGE_REF = /这张图|这张照片|这个照片|上面的图|刚才的图|生成的图|这幅图|此图/;

export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
  contentType?: "text" | "image";
  imageUrl?: string | null;
  attachments?: string | null;
};

export function getTextClient() {
  return createOpenAI({
    apiKey: process.env.TEXT_API_KEY,
    baseURL: process.env.TEXT_API_BASE_URL,
  });
}

function findLastImageUrl(history: HistoryMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role === "assistant" && m.contentType === "image" && m.imageUrl) {
      return m.imageUrl;
    }
  }
  return null;
}

async function imageAttachment(url: string): Promise<MessageAttachment> {
  return {
    id: "ctx-image",
    kind: "image",
    name: "generated.png",
    url,
    mimeType: "image/png",
    size: 0,
  };
}

async function toUserModelMessage(
  content: string,
  attachmentsRaw: string | null | undefined,
  extraImageUrl?: string | null,
): Promise<ModelMessage> {
  const attachments = parseAttachments(attachmentsRaw);

  if (extraImageUrl && attachments.every((a) => a.kind !== "image")) {
    try {
      const parts = await buildModelContentParts(content, [
        ...(await Promise.all([imageAttachment(extraImageUrl)])),
        ...attachments,
      ]);
      return { role: "user", content: parts as ModelContentPart[] };
    } catch {
      // 图片读取失败时退回纯文本，避免整次请求失败
    }
  }

  if (attachments.length > 0) {
    const parts = await buildModelContentParts(content, attachments);
    return { role: "user", content: parts as ModelContentPart[] };
  }

  return { role: "user", content };
}

async function toModelMessage(
  item: HistoryMessage,
  prev: HistoryMessage | null,
): Promise<ModelMessage> {
  if (item.role === "assistant" && item.contentType === "image") {
    return {
      role: "assistant",
      content: `已根据你的描述生成了一张图片。描述：${item.content}`,
    };
  }

  if (item.role === "assistant") {
    return { role: "assistant", content: item.content };
  }

  const attachPrevImage =
    !parseAttachments(item.attachments).some((a) => a.kind === "image") &&
    prev?.role === "assistant" &&
    prev.contentType === "image" &&
    prev.imageUrl;

  return toUserModelMessage(
    item.content,
    item.attachments,
    attachPrevImage ? prev.imageUrl : null,
  );
}

export function mapApiError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("insufficient_quota") || msg.includes("quota is not enough") || msg.includes("quota")) {
    return new Error("QuickRouter API 额度不足，请登录 quickrouter.ai 控制台充值后再试");
  }
  if (msg.includes("No output generated") || msg.includes("Invalid JSON")) {
    return new Error("QuickRouter API 额度不足或模型不可用，请登录 quickrouter.ai 控制台检查余额");
  }
  if (msg.includes("401") || msg.includes("Incorrect API key")) {
    return new Error("API Key 无效，请检查 .env.local 中的 TEXT_API_KEY（QuickRouter 控制台获取）");
  }
  if (msg.includes("ENOTFOUND") || msg.includes("fetch failed")) {
    return new Error("无法连接 API 服务，请检查 TEXT_API_BASE_URL 或网络");
  }
  return err instanceof Error ? err : new Error(msg);
}

type TextStreamFinish = Parameters<typeof streamText>[0]["onFinish"];

export function createTextStream(
  messages: ModelMessage[],
  options?: {
    abortSignal?: AbortSignal;
    onFinish?: TextStreamFinish;
  },
) {
  const modelName = process.env.TEXT_MODEL_NAME ?? "gpt-5.5";
  const maxTokens = Number(process.env.TEXT_MAX_OUTPUT_TOKENS ?? 4096);
  const openai = getTextClient();

  const result = streamText({
    model: openai(modelName),
    messages,
    maxOutputTokens: maxTokens,
    abortSignal: options?.abortSignal,
    onFinish: options?.onFinish,
  });

  return { result, modelName };
}

/** @deprecated 仅测试脚本使用；线上对话请走 createTextStream 流式输出 */
export async function generateTextReply(messages: ModelMessage[]) {
  try {
    const { result, modelName } = createTextStream(messages);
    const text = await result.text;
    const usage = await result.usage;

    if (!text.trim()) {
      throw new Error("模型未返回内容，请稍后重试或简化问题");
    }

    return {
      text,
      usage: usage
        ? {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
      modelName,
    };
  } catch (err) {
    throw mapApiError(err);
  }
}

export async function buildChatMessages(
  history: HistoryMessage[],
  userInput: string,
  userAttachments: MessageAttachment[] = [],
): Promise<ModelMessage[]> {
  const result: ModelMessage[] = [];

  for (let i = 0; i < history.length; i++) {
    result.push(await toModelMessage(history[i], i > 0 ? history[i - 1] : null));
  }

  if (userAttachments.length > 0) {
    const parts = await buildModelContentParts(userInput, userAttachments);
    result.push({ role: "user", content: parts as ModelContentPart[] });
  } else {
    const lastInHistory = history.length > 0 ? history[history.length - 1] : null;
    const lastImage = findLastImageUrl(history);
    const shouldAttach =
      lastImage &&
      (lastInHistory?.contentType === "image" || IMAGE_REF.test(userInput));

    result.push(
      await toUserModelMessage(userInput, null, shouldAttach ? lastImage : null),
    );
  }

  return result;
}
