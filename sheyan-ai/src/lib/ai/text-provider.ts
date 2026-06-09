import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import { parseAttachments, type MessageAttachment, type ModelContentPart } from "@/lib/attachments";
import { buildModelContentParts } from "@/lib/attachments.server";

export const SYSTEM_PROMPT = `你是设研AI，一个简洁专业的 AI 助手，基于 GPT-5.5 大语言模型运行。请用中文回答，语气清晰、结构清楚，像 ChatGPT 一样易读。

身份说明（仅在用户询问时回答）：
- 你是「设研AI」
- 当前使用的大模型是 GPT-5.5
不要说自己是 OpenAI 官方助手，也不要说无法确定模型名称。

输出格式（必须遵守）：
1. 先给一句简短结论，再展开说明
2. 使用标准 Markdown，但语法必须完整正确：
   - 加粗用 **文字**，不要单独输出 ** 符号
   - 代码块必须用成对的三反引号包裹，并写清语言，例如 \`\`\`prisma
   - 不要输出孤立的 \`\`\` 或 --- 等无意义符号行
3. 分段清晰：段落之间空一行；需要分点时用有序/无序列表
4. 标题只用 ## 或 ###，不要滥用 # 或过多层级
5. 代码与技术说明：先解释「是什么/为什么」，再给代码示例
6. 避免堆砌符号、避免重复啰嗦、避免输出 HTML 标签

当用户上传图片或文档时，请结合附件内容作答。`;

export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: string | null;
};

export function getTextClient() {
  return createOpenAI({
    apiKey: process.env.TEXT_API_KEY,
    baseURL: process.env.TEXT_API_BASE_URL,
  });
}

async function toModelMessage(
  role: "user" | "assistant",
  content: string,
  attachmentsRaw?: string | null,
): Promise<ModelMessage> {
  if (role === "assistant") {
    return { role: "assistant", content };
  }

  const attachments = parseAttachments(attachmentsRaw);
  if (attachments.length === 0) {
    return { role: "user", content };
  }

  const parts = await buildModelContentParts(content, attachments);
  return { role: "user", content: parts as ModelContentPart[] };
}

export async function generateTextReply(messages: ModelMessage[]) {
  const modelName = process.env.TEXT_MODEL_NAME ?? "gpt-5.5";
  const maxTokens = Number(process.env.TEXT_MAX_OUTPUT_TOKENS ?? 4096);
  const openai = getTextClient();

  try {
    const result = streamText({
      model: openai(modelName),
      system: SYSTEM_PROMPT,
      messages,
      maxOutputTokens: maxTokens,
    });

    const text = await result.text;
    const usage = await result.usage;

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
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("insufficient_quota") || msg.includes("quota")) {
      throw new Error("API 账户余额不足，请登录 QuickRouter 控制台充值后再试");
    }
    if (msg.includes("401") || msg.includes("Incorrect API key")) {
      throw new Error("API Key 无效，请检查 .env.local 中的 TEXT_API_KEY（QuickRouter 控制台获取）");
    }
    if (msg.includes("ENOTFOUND") || msg.includes("fetch failed")) {
      throw new Error("无法连接 API 服务，请检查 TEXT_API_BASE_URL 或网络");
    }
    throw err;
  }
}

export async function buildChatMessages(
  history: HistoryMessage[],
  userInput: string,
  userAttachments: MessageAttachment[] = [],
): Promise<ModelMessage[]> {
  const result: ModelMessage[] = [];

  for (const item of history) {
    result.push(await toModelMessage(item.role, item.content, item.attachments));
  }

  if (userAttachments.length > 0) {
    const parts = await buildModelContentParts(userInput, userAttachments);
    result.push({ role: "user", content: parts as ModelContentPart[] });
  } else {
    result.push({ role: "user", content: userInput });
  }

  return result;
}
