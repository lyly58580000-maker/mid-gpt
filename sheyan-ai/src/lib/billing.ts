import { prisma } from "@/lib/prisma";
import { BalanceChangeType, UsageStatus, UsageType } from "@prisma/client";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function preDeductPoints(userId: string, points: number, remark: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("USER_NOT_FOUND", "用户不存在", 404);
    if (user.balance < points) {
      throw new AppError("INSUFFICIENT_BALANCE", "余额不足，请联系管理员充值", 402);
    }

    const balanceAfter = user.balance - points;
    await tx.user.update({ where: { id: userId }, data: { balance: balanceAfter } });

    const record = await tx.balanceRecord.create({
      data: {
        userId,
        changeType: BalanceChangeType.consume,
        amount: -points,
        balanceBefore: user.balance,
        balanceAfter,
        remark,
      },
    });

    return { balanceAfter, balanceRecordId: record.id };
  });
}

export async function refundPoints(userId: string, points: number, relatedUsageId?: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const balanceAfter = user.balance + points;
    await tx.user.update({ where: { id: userId }, data: { balance: balanceAfter } });

    await tx.balanceRecord.create({
      data: {
        userId,
        changeType: BalanceChangeType.refund,
        amount: points,
        balanceBefore: user.balance,
        balanceAfter,
        relatedUsageId,
        remark: "调用失败退款",
      },
    });
  });
}

export async function adminAdjustBalance(
  userId: string,
  amount: number,
  remark: string,
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("USER_NOT_FOUND", "用户不存在", 404);

    const balanceAfter = user.balance + amount;
    if (balanceAfter < 0) throw new AppError("INVALID_AMOUNT", "余额不能为负数");

    await tx.user.update({ where: { id: userId }, data: { balance: balanceAfter } });

    return tx.balanceRecord.create({
      data: {
        userId,
        changeType: BalanceChangeType.admin_adjust,
        amount,
        balanceBefore: user.balance,
        balanceAfter,
        remark,
      },
    });
  });
}

export async function createUsageRecord(data: {
  userId: string;
  conversationId?: string;
  messageId?: string;
  usageType: UsageType;
  modelName: string;
  costPoints: number;
  status: UsageStatus;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  actualCost?: number;
  errorMessage?: string;
  responseMs?: number;
}) {
  return prisma.usageRecord.create({ data });
}
