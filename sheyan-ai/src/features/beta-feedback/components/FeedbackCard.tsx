"use client";

import { Check } from "lucide-react";
import {
  BETA_FEEDBACK_REWARD_TIERS,
  type BetaFeedbackRewardTierKey,
} from "@/features/beta-feedback/config";
import type { BetaFeedbackPublicItem } from "@/features/beta-feedback/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FeedbackCard({ item }: { item: BetaFeedbackPublicItem }) {
  const resolved = item.status === "resolved";
  const tierLabel =
    item.rewardTier && item.rewardTier in BETA_FEEDBACK_REWARD_TIERS
      ? BETA_FEEDBACK_REWARD_TIERS[item.rewardTier as BetaFeedbackRewardTierKey].label
      : null;

  return (
    <article
      className={`break-inside-avoid mb-3 rounded-xl border bg-white p-4 shadow-sm transition-colors ${
        resolved ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200"
      }`}
    >
      <div className="mb-2 flex items-start gap-2">
        <div
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
            resolved
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-gray-300 bg-white"
          }`}
          title={resolved ? "已解决" : "待处理"}
        >
          {resolved && <Check size={12} strokeWidth={3} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{item.publicAlias}</span>
            <span>·</span>
            <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
            {resolved && item.resolvedAt && (
              <>
                <span>·</span>
                <span className="text-emerald-600">已解决 {formatTime(item.resolvedAt)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{item.content}</p>

      {item.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.attachments.map((att) => (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border border-gray-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={att.url} alt={att.name} className="max-h-36 max-w-full object-cover" />
            </a>
          ))}
        </div>
      )}

      {resolved && (item.resolvedNote || item.rewardPoints > 0) && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-white/80 px-3 py-2 text-xs text-emerald-800">
          {item.resolvedNote && <p className="leading-relaxed">{item.resolvedNote}</p>}
          {item.rewardPoints > 0 && (
            <p className="mt-1 font-medium">
              +{item.rewardPoints} 积分已发放{tierLabel ? `（${tierLabel}）` : ""}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
