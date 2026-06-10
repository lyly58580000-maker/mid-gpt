import type { ModelMessage } from "ai";
import { prisma } from "@/lib/prisma";
import { BASE_SYSTEM_PROMPT } from "@/lib/ai/base-system-prompt";
import {
  detectRiskTopics,
  shouldSkipMemory,
  UNCERTAINTY_INSTRUCTION,
} from "@/lib/ai/risk-detector";
import {
  buildChatMessages,
  type HistoryMessage,
} from "@/lib/ai/text-provider";
import type { MessageAttachment } from "@/lib/attachments";

export type PromptContextInput = {
  userId: string;
  conversationId: string;
  projectId?: string | null;
  answerModeSlug?: string | null;
  sceneTemplateSlug?: string | null;
  useMemory?: boolean;
  userMessage: string;
  history: HistoryMessage[];
  attachments?: MessageAttachment[];
};

export type PromptContextMeta = {
  answerModeName: string;
  usedProfile: boolean;
  usedProjectMemory: boolean;
  usedConversationSummary: boolean;
  usedSceneTemplate: boolean;
  riskDetected: boolean;
};

const DEFAULT_ANSWER_MODE = {
  slug: "quick",
  name: "快速回答",
  instruction: `回答控制在 300 到 600 字以内。先给结论，再给 3 到 5 个关键点。不要长篇铺开，不要过度解释。`,
};

function formatProfile(profile: {
  identitySummary?: string | null;
  preferenceSummary?: string | null;
  commonTasks?: string | null;
  dislikedStyles?: string | null;
  outputPreference?: string | null;
  expertiseLevel?: string | null;
  interactionStyle?: string | null;
} | null): string | null {
  if (!profile) return null;
  const parts = [
    profile.identitySummary && `身份：${profile.identitySummary}`,
    profile.preferenceSummary && `偏好：${profile.preferenceSummary}`,
    profile.commonTasks && `常见任务：${profile.commonTasks}`,
    profile.dislikedStyles && `不喜欢的风格：${profile.dislikedStyles}`,
    profile.outputPreference && `输出偏好：${profile.outputPreference}`,
    profile.expertiseLevel && `专业水平：${profile.expertiseLevel}`,
    profile.interactionStyle && `交互风格：${profile.interactionStyle}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("\n") : null;
}

function formatProject(project: {
  name: string;
  type?: string | null;
  summary?: string | null;
  currentStage?: string | null;
  keyDecisions?: string | null;
  constraints?: string | null;
} | null): string | null {
  if (!project) return null;
  const parts = [
    `项目名称：${project.name}`,
    project.type && `类型：${project.type}`,
    project.summary && `简介：${project.summary}`,
    project.currentStage && `当前阶段：${project.currentStage}`,
    project.keyDecisions && `已确认决策：${project.keyDecisions}`,
    project.constraints && `约束：${project.constraints}`,
  ].filter(Boolean);
  return parts.join("\n");
}

function formatMemories(
  memories: { memoryType: string; content: string; confidence: number }[],
): string | null {
  if (memories.length === 0) return null;
  return memories
    .map((m) => `- [${m.memoryType}|置信${m.confidence}] ${m.content}`)
    .join("\n");
}

export async function buildPromptContext(
  input: PromptContextInput,
): Promise<{ messages: ModelMessage[]; meta: PromptContextMeta }> {
  const skipMemory = input.useMemory === false || shouldSkipMemory(input.userMessage);
  const riskDetected = detectRiskTopics(input.userMessage);

  const [profile, project, convSummary, answerMode, sceneTemplate, projectMemories] =
    await Promise.all([
      skipMemory
        ? null
        : prisma.userProfile.findUnique({ where: { userId: input.userId } }),
      skipMemory || !input.projectId
        ? null
        : prisma.project.findFirst({
            where: { id: input.projectId, userId: input.userId, status: "active" },
          }),
      skipMemory
        ? null
        : prisma.conversationSummary.findUnique({
            where: { conversationId: input.conversationId },
          }),
      prisma.answerMode.findFirst({
        where: {
          slug: input.answerModeSlug ?? "quick",
          // allow fallback
        },
      }),
      input.sceneTemplateSlug
        ? prisma.sceneTemplate.findFirst({
            where: { slug: input.sceneTemplateSlug, isActive: true },
          })
        : null,
      skipMemory || !input.projectId
        ? []
        : prisma.projectMemory.findMany({
            where: { userId: input.userId, projectId: input.projectId },
            orderBy: { updatedAt: "desc" },
            take: 20,
          }),
    ]);

  const mode = answerMode ?? (await prisma.answerMode.findFirst({ where: { isDefault: true } }));
  const resolvedMode = mode ?? DEFAULT_ANSWER_MODE;

  const systemLayers: string[] = [BASE_SYSTEM_PROMPT];

  const profileText = formatProfile(profile);
  if (profileText) {
    systemLayers.push(`当前用户画像：\n${profileText}`);
  }

  const projectText = formatProject(project);
  const memoryText = formatMemories(projectMemories);
  if (projectText || memoryText) {
    const block = [projectText, memoryText && `项目记忆条目：\n${memoryText}`]
      .filter(Boolean)
      .join("\n\n");
    systemLayers.push(`当前项目记忆：\n${block}`);
  }

  if (convSummary?.summary || convSummary?.keyPoints || convSummary?.latestUserIntent) {
    const summaryParts = [
      convSummary.summary && `摘要：${convSummary.summary}`,
      convSummary.keyPoints && `要点：${convSummary.keyPoints}`,
      convSummary.latestUserIntent && `最近意图：${convSummary.latestUserIntent}`,
    ].filter(Boolean);
    systemLayers.push(`当前会话摘要：\n${summaryParts.join("\n")}`);
  }

  systemLayers.push(
    `当前回答模式（${resolvedMode.name}）：\n${resolvedMode.instruction}`,
  );

  if (sceneTemplate) {
    systemLayers.push(
      `当前场景模板（${sceneTemplate.name}）：\n${sceneTemplate.systemInstruction}${
        sceneTemplate.outputStructure ? `\n\n推荐输出结构：\n${sceneTemplate.outputStructure}` : ""
      }`,
    );
  }

  if (riskDetected) {
    systemLayers.push(`边界提示要求：\n${UNCERTAINTY_INSTRUCTION}`);
  }

  const recentHistory =
    convSummary?.summary && input.history.length > 8
      ? input.history.slice(-6)
      : input.history.slice(-12);

  const chatMessages = await buildChatMessages(
    recentHistory,
    input.userMessage,
    input.attachments ?? [],
  );

  const messages: ModelMessage[] = [
    ...systemLayers.map((content) => ({ role: "system" as const, content })),
    ...chatMessages,
  ];

  return {
    messages,
    meta: {
      answerModeName: resolvedMode.name,
      usedProfile: Boolean(profileText),
      usedProjectMemory: Boolean(projectText || memoryText),
      usedConversationSummary: Boolean(convSummary?.summary || convSummary?.keyPoints),
      usedSceneTemplate: Boolean(sceneTemplate),
      riskDetected,
    },
  };
}
