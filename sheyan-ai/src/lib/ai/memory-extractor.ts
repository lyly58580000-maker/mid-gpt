import { prisma } from "@/lib/prisma";
import { extractForgetTarget } from "@/lib/ai/risk-detector";

type ExtractInput = {
  userId: string;
  conversationId: string;
  projectId?: string | null;
  userMessage: string;
  assistantReply: string;
};

const PREFERENCE_PATTERNS = [
  { pattern: /以后都?给我简洁/, content: "用户偏好简洁回答", field: "outputPreference" as const },
  { pattern: /以后都?详细/, content: "用户偏好详细回答", field: "outputPreference" as const },
  { pattern: /不要复杂/, content: "用户不喜欢复杂冗长的回答", field: "dislikedStyles" as const },
  { pattern: /表格化/, content: "用户偏好表格化输出", field: "outputPreference" as const },
];

const DECISION_PATTERNS = [
  /(?:就|确定|决定)(?:作为|用)?(?:最终|这个)?版/,
  /我们就不做(.{2,30})/,
  /不再做(.{2,30})/,
];

function appendText(existing: string | null | undefined, addition: string): string {
  if (!existing?.trim()) return addition;
  if (existing.includes(addition)) return existing;
  return `${existing}\n${addition}`;
}

export async function applyMemoryUpdates(input: ExtractInput): Promise<void> {
  const forgetTarget = extractForgetTarget(input.userMessage);
  if (forgetTarget && input.projectId) {
    await prisma.projectMemory.deleteMany({
      where: {
        userId: input.userId,
        projectId: input.projectId,
        content: { contains: forgetTarget },
      },
    });
  }

  for (const { pattern, content, field } of PREFERENCE_PATTERNS) {
    if (!pattern.test(input.userMessage)) continue;
    await prisma.userProfile.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, [field]: content },
      update: { [field]: content },
    });
    break;
  }

  if (input.projectId) {
    for (const pattern of DECISION_PATTERNS) {
      const match = input.userMessage.match(pattern);
      if (!match) continue;
      const content = match[0].trim();
      await prisma.projectMemory.create({
        data: {
          userId: input.userId,
          projectId: input.projectId,
          memoryType: "decision",
          content,
          confidence: 0.85,
          sourceConversationId: input.conversationId,
        },
      });
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, userId: input.userId },
      });
      if (project) {
        await prisma.project.update({
          where: { id: project.id },
          data: { keyDecisions: appendText(project.keyDecisions, content) },
        });
      }
      break;
    }
  }

  await updateConversationSummary(input);
}

async function updateConversationSummary(input: ExtractInput): Promise<void> {
  const snippet = input.userMessage.slice(0, 120);
  const replySnippet = input.assistantReply.slice(0, 200);
  const summary = `用户最近询问：${snippet}`;
  const keyPoints = replySnippet;

  await prisma.conversationSummary.upsert({
    where: { conversationId: input.conversationId },
    create: {
      userId: input.userId,
      conversationId: input.conversationId,
      projectId: input.projectId ?? null,
      summary,
      keyPoints,
      latestUserIntent: snippet,
    },
    update: {
      projectId: input.projectId ?? null,
      summary,
      keyPoints,
      latestUserIntent: snippet,
    },
  });
}
