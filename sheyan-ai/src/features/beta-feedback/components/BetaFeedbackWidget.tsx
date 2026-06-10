"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  MessageSquareWarning,
  Send,
  ImagePlus,
  Loader2,
  Gift,
  X,
  PenLine,
} from "lucide-react";
import {
  BETA_FEEDBACK_CONTENT_MAX,
  BETA_FEEDBACK_INTRO,
  BETA_FEEDBACK_MAX_IMAGES,
  BETA_FEEDBACK_REWARD_TIERS,
} from "@/features/beta-feedback/config";
import type { BetaFeedbackAttachment, BetaFeedbackPublicItem } from "@/features/beta-feedback/types";
import { FeedbackCard } from "@/features/beta-feedback/components/FeedbackCard";

const PANEL_OPEN_KEY = "beta-feedback-panel-open";

function readPanelOpen(): boolean {
  if (typeof window === "undefined") return false;
  const saved = window.localStorage.getItem(PANEL_OPEN_KEY);
  if (saved !== null) return saved === "true";
  return window.matchMedia("(min-width: 768px)").matches;
}

export function BetaFeedbackWidget() {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<BetaFeedbackPublicItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<BetaFeedbackAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpanded(readPanelOpen());
  }, []);

  const setPanelExpanded = (open: boolean) => {
    setExpanded(open);
    window.localStorage.setItem(PANEL_OPEN_KEY, open ? "true" : "false");
  };

  const loadFeed = useCallback(async (cursor?: string, append = false) => {
    setLoadingFeed(true);
    if (!append) setError("");
    try {
      const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const res = await fetch(`/api/beta-feedback${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "加载失败");
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && items.length === 0) {
      loadFeed();
    }
  }, [expanded, items.length, loadFeed]);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (attachments.length >= BETA_FEEDBACK_MAX_IMAGES) {
      setError(`最多 ${BETA_FEEDBACK_MAX_IMAGES} 张截图`);
      return;
    }
    setUploading(true);
    setError("");
    try {
      const next = [...attachments];
      for (const file of Array.from(files).slice(0, BETA_FEEDBACK_MAX_IMAGES - next.length)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/beta-feedback/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message ?? "上传失败");
        next.push(data.attachment);
      }
      setAttachments(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/beta-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, attachments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "提交失败");
      setContent("");
      setAttachments([]);
      setSuccess("已提交，感谢骂醒我！");
      setItems((prev) => [data.item, ...prev]);
      setShowForm(false);
      feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* 收起时：右下角悬浮按钮 */}
      {!expanded && (
        <button
          type="button"
          onClick={() => setPanelExpanded(true)}
          aria-label="灰度反馈"
          className="fixed z-[90] flex items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 hover:shadow-xl top-[max(0.625rem,env(safe-area-inset-top))] right-3 h-10 w-10 md:bottom-6 md:right-6 md:top-auto md:h-auto md:w-auto md:gap-2 md:px-4 md:py-3 md:text-sm md:font-medium"
        >
          <MessageSquareWarning size={18} />
          <span className="hidden md:inline">灰度反馈</span>
        </button>
      )}

      {/* 展开时：右侧全局浮层 */}
      <aside
        className={`fixed right-0 top-0 z-[90] flex h-full w-[min(100vw,380px)] flex-col border-l border-gray-200 bg-[#f7f7f8] shadow-[-8px_0_30px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-out ${
          expanded ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        aria-hidden={!expanded}
      >
        {/* 顶栏 */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">灰度内测留言板</h2>
          <button
            type="button"
            onClick={() => setPanelExpanded(false)}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title="收起"
          >
            收起
            <ChevronRight size={16} />
          </button>
        </div>

        {/* 可滚动主体 */}
        <div ref={feedRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="border-b border-gray-200 bg-white px-4 py-3">
            <p className="text-xs leading-relaxed text-gray-600">{BETA_FEEDBACK_INTRO}</p>
          </div>

          <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1 text-xs font-medium text-amber-900">
              <Gift size={14} />
              有效反馈可获积分（管理员核实后发放）
            </div>
            <ul className="space-y-1 text-xs leading-relaxed text-amber-900/90">
              {Object.values(BETA_FEEDBACK_REWARD_TIERS).map((t) => (
                <li key={t.key}>
                  {t.label} +{t.points} 分 · {t.hint}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-b border-gray-200 bg-white px-4 py-2">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
            >
              <PenLine size={14} />
              {showForm ? "收起反馈表单" : "我要写一条反馈"}
            </button>
          </div>

          {showForm && (
            <div className="border-b border-gray-200 bg-white px-4 py-3">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="问题描述、复现步骤、希望的优化方向…"
                rows={4}
                maxLength={BETA_FEEDBACK_CONTENT_MAX}
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs leading-relaxed outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <div className="mt-1 text-right text-[10px] text-gray-400">
                {content.length}/{BETA_FEEDBACK_CONTENT_MAX}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div key={att.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.url}
                      alt={att.name}
                      className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setAttachments((p) => p.filter((a) => a.id !== att.id))}
                      className="absolute -right-1 -top-1 rounded-full bg-gray-800 p-0.5 text-white"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {attachments.length < BETA_FEEDBACK_MAX_IMAGES && (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 text-[10px] text-gray-500 hover:border-indigo-300"
                  >
                    {uploading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <ImagePlus size={16} className="mb-0.5" />
                        截图
                      </>
                    )}
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                multiple
                onChange={(e) => handleUpload(e.target.files)}
              />

              {error && showForm && (
                <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] text-red-600">{error}</p>
              )}
              {success && (
                <p className="mt-2 rounded-lg bg-green-50 px-2 py-1.5 text-[11px] text-green-700">{success}</p>
              )}

              <button
                type="button"
                disabled={submitting || content.trim().length < 8}
                onClick={handleSubmit}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2 text-xs font-medium text-white disabled:opacity-40"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                匿名提交
              </button>
            </div>
          )}

          <div className="px-3 py-3">
            <p className="mb-2 px-1 text-[11px] font-medium text-gray-500">公共留言（匿名）</p>

            {loadingFeed && items.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">加载中...</p>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">还没有留言，来做第一个骂我的人吧</p>
            ) : (
              <div className="columns-1 gap-2">
                {items.map((item) => (
                  <FeedbackCard key={item.id} item={item} />
                ))}
              </div>
            )}

            {error && !showForm && (
              <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] text-red-600">{error}</p>
            )}

            {nextCursor && (
              <button
                type="button"
                disabled={loadingFeed}
                onClick={() => loadFeed(nextCursor, true)}
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingFeed ? "加载中..." : "加载更多"}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
