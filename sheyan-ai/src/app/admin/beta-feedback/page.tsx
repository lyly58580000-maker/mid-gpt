"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RotateCcw, Loader2 } from "lucide-react";
import {
  BETA_FEEDBACK_REWARD_TIERS,
  type BetaFeedbackRewardTierKey,
} from "@/features/beta-feedback/config";
import type { BetaFeedbackAdminItem } from "@/features/beta-feedback/types";

export default function AdminBetaFeedbackPage() {
  const [items, setItems] = useState<BetaFeedbackAdminItem[]>([]);
  const [stats, setStats] = useState({ open: 0, resolved: 0 });
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<BetaFeedbackAdminItem | null>(null);
  const [rewardTier, setRewardTier] = useState<BetaFeedbackRewardTierKey>("normal");
  const [resolvedNote, setResolvedNote] = useState("感谢反馈，问题已修复。");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/beta-feedback${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "加载失败");
      setItems(data.items);
      setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const patchItem = async (id: string, body: Record<string, string>) => {
    setActingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/beta-feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "操作失败");
      setResolveTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">待处理</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{stats.open}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">已解决</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{stats.resolved}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 col-span-2 sm:col-span-1">
          <p className="text-sm text-gray-500">积分档位</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            {Object.values(BETA_FEEDBACK_REWARD_TIERS)
              .map((t) => `${t.label}+${t.points}`)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "open", "resolved"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              filter === f ? "bg-indigo-600 text-white" : "bg-white border text-gray-600"
            }`}
          >
            {f === "all" ? "全部" : f === "open" ? "待处理" : "已解决"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">暂无反馈</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border bg-white p-5 ${
                item.status === "resolved" ? "border-emerald-200" : "border-gray-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm">
                    {item.status === "resolved" ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Check size={16} /> 已解决
                      </span>
                    ) : (
                      <span className="text-amber-600">待处理</span>
                    )}
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500">
                      {new Date(item.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    公开：{item.publicAlias} · 后台：{item.userEmail}
                    {item.userNickname ? `（${item.userNickname}）` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {item.status === "open" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setResolveTarget(item);
                        setRewardTier("normal");
                        setResolvedNote("感谢反馈，问题已修复。");
                      }}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
                    >
                      标记已解决
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={actingId === item.id}
                      onClick={() => patchItem(item.id, { action: "reopen" })}
                      className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      {actingId === item.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RotateCcw size={14} />
                      )}
                      重新打开
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {item.content}
              </p>

              {item.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.attachments.map((att) => (
                    <a key={att.id} href={att.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={att.url}
                        alt={att.name}
                        className="h-24 rounded-lg border object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}

              {item.status === "resolved" && (
                <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {item.resolvedNote}
                  {item.rewardPoints > 0 && (
                    <span className="ml-2 font-medium">+{item.rewardPoints} 积分已发放</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {resolveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">标记为已解决</h3>
            <p className="mt-1 text-sm text-gray-500 truncate">{resolveTarget.content.slice(0, 80)}…</p>

            <label className="mt-4 block text-sm font-medium text-gray-700">积分档位</label>
            <div className="mt-2 space-y-2">
              {Object.values(BETA_FEEDBACK_REWARD_TIERS).map((t) => (
                <label
                  key={t.key}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
                    rewardTier === t.key ? "border-indigo-400 bg-indigo-50" : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    checked={rewardTier === t.key}
                    onChange={() => setRewardTier(t.key as BetaFeedbackRewardTierKey)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">
                      {t.label} · +{t.points} 积分
                    </span>
                    <span className="block text-xs text-gray-500">{t.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            <label className="mt-4 block text-sm font-medium text-gray-700">公开回复（用户可见）</label>
            <textarea
              value={resolvedNote}
              onChange={(e) => setResolvedNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolveTarget(null)}
                className="rounded-lg border px-4 py-2 text-sm text-gray-600"
              >
                取消
              </button>
              <button
                type="button"
                disabled={actingId === resolveTarget.id}
                onClick={() =>
                  patchItem(resolveTarget.id, {
                    action: "resolve",
                    rewardTier,
                    resolvedNote,
                  })
                }
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {actingId === resolveTarget.id && <Loader2 size={14} className="animate-spin" />}
                确认并发放积分
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
