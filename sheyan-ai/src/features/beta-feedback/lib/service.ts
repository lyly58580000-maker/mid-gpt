import { BalanceChangeType, BetaFeedbackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BETA_FEEDBACK_REWARD_TIERS,
  type BetaFeedbackRewardTierKey,
} from "@/features/beta-feedback/config";
import { buildPublicAlias } from "@/features/beta-feedback/lib/alias";
import type {
  BetaFeedbackAttachment,
  BetaFeedbackAdminItem,
  BetaFeedbackPublicItem,
} from "@/features/beta-feedback/types";

function parseAttachments(raw: string | null): BetaFeedbackAttachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as BetaFeedbackAttachment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toPublicItem(row: {
  id: string;
  publicAlias: string;
  content: string;
  attachments: string | null;
  status: BetaFeedbackStatus;
  resolvedAt: Date | null;
  resolvedNote: string | null;
  rewardPoints: number;
  rewardTier: string | null;
  createdAt: Date;
}): BetaFeedbackPublicItem {
  return {
    id: row.id,
    publicAlias: row.publicAlias,
    content: row.content,
    attachments: parseAttachments(row.attachments),
    status: row.status,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedNote: row.resolvedNote,
    rewardPoints: row.rewardPoints,
    rewardTier: row.rewardTier,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPublicBetaFeedback(opts?: {
  cursor?: string;
  limit?: number;
}): Promise<{ items: BetaFeedbackPublicItem[]; nextCursor: string | null }> {
  const limit = Math.min(opts?.limit ?? 40, 60);
  const rows = await prisma.betaFeedback.findMany({
    take: limit + 1,
    ...(opts?.cursor
      ? {
          cursor: { id: opts.cursor },
          skip: 1,
        }
      : {}),
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: slice.map(toPublicItem),
    nextCursor: hasMore ? slice[slice.length - 1]!.id : null,
  };
}

export async function listAdminBetaFeedback(status?: BetaFeedbackStatus) {
  const rows = await prisma.betaFeedback.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      user: { select: { id: true, email: true, nickname: true } },
    },
  });

  return rows.map(
    (row): BetaFeedbackAdminItem => ({
      ...toPublicItem(row),
      userId: row.user.id,
      userEmail: row.user.email,
      userNickname: row.user.nickname,
    }),
  );
}

export async function createBetaFeedback(input: {
  userId: string;
  content: string;
  attachments?: BetaFeedbackAttachment[];
}) {
  return prisma.betaFeedback.create({
    data: {
      userId: input.userId,
      publicAlias: buildPublicAlias(input.userId),
      content: input.content.trim(),
      attachments: input.attachments?.length
        ? JSON.stringify(input.attachments)
        : null,
    },
  });
}

export async function resolveBetaFeedback(input: {
  id: string;
  rewardTier: BetaFeedbackRewardTierKey;
  resolvedNote?: string;
}) {
  const tier = BETA_FEEDBACK_REWARD_TIERS[input.rewardTier];
  if (!tier) throw new Error("INVALID_TIER");

  const existing = await prisma.betaFeedback.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.status === BetaFeedbackStatus.resolved) {
    throw new Error("ALREADY_RESOLVED");
  }

  const note = input.resolvedNote?.trim() || `感谢反馈，问题已处理。`;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.betaFeedback.update({
      where: { id: input.id },
      data: {
        status: BetaFeedbackStatus.resolved,
        resolvedAt: new Date(),
        resolvedNote: note,
        rewardPoints: tier.points,
        rewardTier: tier.key,
      },
    });

    if (tier.points > 0) {
      const user = await tx.user.findUnique({ where: { id: existing.userId } });
      if (user) {
        const balanceAfter = user.balance + tier.points;
        await tx.user.update({
          where: { id: user.id },
          data: { balance: balanceAfter },
        });
        await tx.balanceRecord.create({
          data: {
            userId: user.id,
            changeType: BalanceChangeType.system_gift,
            amount: tier.points,
            balanceBefore: user.balance,
            balanceAfter,
            remark: `灰度反馈奖励 · ${tier.label} · #${existing.id.slice(-6)}`,
          },
        });
      }
    }

    return row;
  });

  return toPublicItem(updated);
}

export async function reopenBetaFeedback(id: string) {
  const existing = await prisma.betaFeedback.findUnique({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  const updated = await prisma.betaFeedback.update({
    where: { id },
    data: {
      status: BetaFeedbackStatus.open,
      resolvedAt: null,
      resolvedNote: null,
      rewardPoints: 0,
      rewardTier: null,
    },
  });

  return toPublicItem(updated);
}

export function getBetaFeedbackStats() {
  return prisma.betaFeedback.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
}
