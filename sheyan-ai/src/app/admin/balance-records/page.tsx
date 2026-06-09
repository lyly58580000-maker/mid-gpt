"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, X, Tag, Wallet, Activity, Clock3 } from "lucide-react";

type SortMode = "newest" | "oldest" | "usage" | "frequency" | "balance";

type ApiQuota = {
  available: boolean;
  balance: number | null;
  total: number | null;
  used: number | null;
  currency: string;
  source: string;
  updatedAt: string;
  error?: string;
};

type BalanceRecord = {
  id: string;
  changeType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  remark: string | null;
  createdAt: string;
};

type UserSummary = {
  id: string;
  email: string;
  nickname: string | null;
  balance: number;
  tags: string[];
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  usageCount: number;
  totalConsumed: number;
  lastActiveAt: string;
  recentRecords: BalanceRecord[];
};

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "newest", label: "新用户优先" },
  { key: "oldest", label: "老用户优先" },
  { key: "usage", label: "按用量" },
  { key: "frequency", label: "按频率" },
  { key: "balance", label: "按余额" },
];

const TYPE_LABEL: Record<string, string> = {
  recharge: "充值",
  consume: "消费",
  refund: "退款",
  admin_adjust: "管理员调整",
  system_gift: "系统赠送",
};

const TAG_COLORS = [
  "bg-indigo-50 text-indigo-700 border-indigo-100",
  "bg-emerald-50 text-emerald-700 border-emerald-100",
  "bg-amber-50 text-amber-700 border-amber-100",
  "bg-rose-50 text-rose-700 border-rose-100",
  "bg-sky-50 text-sky-700 border-sky-100",
];

function formatMoney(value: number | null, currency = "USD") {
  if (value == null) return "—";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 4,
  }).format(value);
}

function tagColor(tag: string) {
  const index = tag.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return TAG_COLORS[index % TAG_COLORS.length];
}

export default function BalanceRecordsPage() {
  const [sort, setSort] = useState<SortMode>("newest");
  const [tagFilter, setTagFilter] = useState("");
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [apiQuota, setApiQuota] = useState<ApiQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingQuota, setRefreshingQuota] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<UserSummary | null>(null);
  const [detailRecords, setDetailRecords] = useState<BalanceRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [savingTags, setSavingTags] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort });
      if (tagFilter) params.set("tag", tagFilter);
      const res = await fetch(`/api/admin/balance-records?${params.toString()}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setAllTags(data.allTags ?? []);
      setApiQuota(data.apiQuota ?? null);
    } finally {
      setLoading(false);
    }
  }, [sort, tagFilter]);

  const refreshQuota = async () => {
    setRefreshingQuota(true);
    try {
      await loadOverview();
    } finally {
      setRefreshingQuota(false);
    }
  };

  const loadUserDetail = useCallback(async (userId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/balance-records?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.user) setDetailUser(data.user);
      setDetailRecords(data.records ?? []);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (selectedUserId) loadUserDetail(selectedUserId);
  }, [selectedUserId, loadUserDetail]);

  const quotaPercent = useMemo(() => {
    if (!apiQuota?.total || apiQuota.balance == null) return null;
    return Math.max(0, Math.min(100, (apiQuota.balance / apiQuota.total) * 100));
  }, [apiQuota]);

  const openUser = (user: UserSummary) => {
    setSelectedUserId(user.id);
    setDetailUser(user);
    setTagInput("");
  };

  const closeDetail = () => {
    setSelectedUserId(null);
    setDetailUser(null);
    setDetailRecords([]);
    setTagInput("");
  };

  const saveTags = async (tags: string[]) => {
    if (!detailUser) return;
    setSavingTags(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: detailUser.id, tags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "保存标签失败");
      const nextTags = data.tags ?? tags;
      setDetailUser({ ...detailUser, tags: nextTags });
      setUsers((prev) => prev.map((user) => (user.id === detailUser.id ? { ...user, tags: nextTags } : user)));
      setAllTags((prev) => [...new Set([...prev, ...nextTags])].sort());
      setTagInput("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存标签失败");
    } finally {
      setSavingTags(false);
    }
  };

  const addTag = () => {
    if (!detailUser || !tagInput.trim()) return;
    const next = [...new Set([...detailUser.tags, tagInput.trim()])];
    saveTags(next);
  };

  const removeTag = (tag: string) => {
    if (!detailUser) return;
    saveTags(detailUser.tags.filter((item) => item !== tag));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-gradient-to-r from-gray-900 via-gray-800 to-indigo-900 text-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Wallet size={16} />
              QuickRouter API 总额度
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">
              {apiQuota?.available ? formatMoney(apiQuota.balance, apiQuota.currency) : "暂不可用"}
            </div>
            <div className="mt-1 text-sm text-white/70">
              {apiQuota?.available ? (
                <>
                  已用 {formatMoney(apiQuota.used, apiQuota.currency)} / 总量{" "}
                  {formatMoney(apiQuota.total, apiQuota.currency)}
                </>
              ) : (
                (apiQuota?.error ?? "请检查 QuickRouter API Key 或网络")
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-white/60">
              <div>来源：{apiQuota?.source ?? "quickrouter"}</div>
              <div>
                更新：
                {apiQuota?.updatedAt
                  ? new Date(apiQuota.updatedAt).toLocaleString("zh-CN")
                  : "—"}
              </div>
            </div>
            <button
              onClick={refreshQuota}
              disabled={refreshingQuota}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshingQuota ? "animate-spin" : ""} />
              刷新额度
            </button>
          </div>
        </div>

        {quotaPercent != null && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-white/70">
              <span>剩余占比</span>
              <span>{quotaPercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">用户余额流水</h2>
            <p className="text-sm text-gray-500">按用户分块查看，支持排序、标签筛选与详情流水</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setSort(option.key)}
                className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
                  sort === option.key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">标签筛选：</span>
            <button
              onClick={() => setTagFilter("")}
              className={`rounded-full px-3 py-1 text-xs border ${
                !tagFilter ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              全部
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTagFilter(tag)}
                className={`rounded-full px-3 py-1 text-xs border ${
                  tagFilter === tag ? "bg-indigo-600 text-white border-indigo-600" : tagColor(tag)
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-gray-500">加载中...</div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-gray-500">暂无用户数据</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => openUser(user)}
                className="text-left rounded-2xl border bg-white p-5 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{user.nickname || user.email}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-semibold text-indigo-600">{user.balance}</div>
                    <div className="text-xs text-gray-400">剩余点数</div>
                  </div>
                </div>

                {user.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {user.tags.map((tag) => (
                      <span key={tag} className={`rounded-full border px-2 py-0.5 text-[11px] ${tagColor(tag)}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-gray-50 px-2 py-2">
                    <div className="text-sm font-medium">{user.totalConsumed}</div>
                    <div className="text-[11px] text-gray-500">总消耗</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-2 py-2">
                    <div className="text-sm font-medium">{user.usageCount}</div>
                    <div className="text-[11px] text-gray-500">调用次数</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-2 py-2">
                    <div className="text-sm font-medium">
                      {new Date(user.lastActiveAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                    </div>
                    <div className="text-[11px] text-gray-500">最近活跃</div>
                  </div>
                </div>

                {user.recentRecords.length > 0 && (
                  <div className="mt-4 space-y-2 border-t pt-3">
                    {user.recentRecords.slice(0, 2).map((record) => (
                      <div key={record.id} className="flex items-center justify-between text-xs text-gray-500">
                        <span>{TYPE_LABEL[record.changeType] ?? record.changeType}</span>
                        <span className={record.amount > 0 ? "text-emerald-600" : "text-rose-600"}>
                          {record.amount > 0 ? `+${record.amount}` : record.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedUserId && detailUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={closeDetail}>
          <div
            className="h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold">{detailUser.nickname || detailUser.email}</h3>
                <p className="text-sm text-gray-500">{detailUser.email}</p>
              </div>
              <button onClick={closeDetail} className="rounded-lg p-2 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Wallet size={16} /> 当前余额
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{detailUser.balance} 点</div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Activity size={16} /> 总消耗
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{detailUser.totalConsumed} 点</div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock3 size={16} /> 调用次数
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{detailUser.usageCount}</div>
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Tag size={16} /> 用户标签
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {detailUser.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${tagColor(tag)}`}
                    >
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:opacity-70">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="输入标签，如 VIP / 高频用户"
                    className="flex-1 rounded-xl border px-3 py-2 text-sm"
                  />
                  <button
                    onClick={addTag}
                    disabled={savingTags || !tagInput.trim()}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                  >
                    添加
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border overflow-hidden">
                <div className="border-b px-4 py-3 font-medium">完整流水记录</div>
                {detailLoading ? (
                  <div className="p-6 text-gray-500">加载流水...</div>
                ) : detailRecords.length === 0 ? (
                  <div className="p-6 text-gray-500">暂无流水记录</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left">时间</th>
                        <th className="px-4 py-3 text-left">类型</th>
                        <th className="px-4 py-3 text-left">变动</th>
                        <th className="px-4 py-3 text-left">余额</th>
                        <th className="px-4 py-3 text-left">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRecords.map((record) => (
                        <tr key={record.id} className="border-t">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {new Date(record.createdAt).toLocaleString("zh-CN")}
                          </td>
                          <td className="px-4 py-3">{TYPE_LABEL[record.changeType] ?? record.changeType}</td>
                          <td className={`px-4 py-3 ${record.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {record.amount > 0 ? `+${record.amount}` : record.amount}
                          </td>
                          <td className="px-4 py-3">
                            {record.balanceBefore} → {record.balanceAfter}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{record.remark ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
