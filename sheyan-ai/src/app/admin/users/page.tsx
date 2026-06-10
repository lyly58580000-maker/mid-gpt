"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock3,
  LayoutGrid,
  List,
  RefreshCw,
  Tag,
  Wallet,
  X,
} from "lucide-react";

type ViewMode = "list" | "cards";
type SortMode = "newest" | "oldest" | "usage" | "frequency" | "balance";

type ApiQuota = {
  available: boolean;
  balance: number | null;
  total: number | null;
  used: number | null;
  unlimited?: boolean;
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

type UserProfile = {
  identitySummary?: string | null;
  preferenceSummary?: string | null;
  commonTasks?: string | null;
  dislikedStyles?: string | null;
  outputPreference?: string | null;
  expertiseLevel?: string | null;
  interactionStyle?: string | null;
};

type UserProject = {
  id: string;
  name: string;
  type?: string | null;
  summary?: string | null;
  currentStage?: string | null;
  memories: { id: string; memoryType: string; content: string }[];
  conversationCount: number;
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

function formatRegisterTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function avatarGradient(email: string) {
  const n = email.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const hues = [
    "from-indigo-500 to-purple-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
    "from-sky-500 to-blue-600",
  ];
  return hues[n % hues.length];
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="text-sm">
      <p className="text-gray-500 mb-1">{label}</p>
      <p className="text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 min-h-[2.5rem]">
        {value?.trim() || "—"}
      </p>
    </div>
  );
}

export default function AdminUsersPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sort, setSort] = useState<SortMode>("newest");
  const [tagFilter, setTagFilter] = useState("");
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [apiQuota, setApiQuota] = useState<ApiQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingQuota, setRefreshingQuota] = useState(false);

  const [detailUser, setDetailUser] = useState<UserSummary | null>(null);
  const [detailRecords, setDetailRecords] = useState<BalanceRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [savingTags, setSavingTags] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<UserSummary | null>(null);
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");

  const [workspaceUser, setWorkspaceUser] = useState<UserSummary | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<UserProject[]>([]);

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

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const filteredUsers = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(keyword) ||
        (u.nickname?.toLowerCase().includes(keyword) ?? false),
    );
  }, [users, q]);

  const quotaPercent = useMemo(() => {
    if (!apiQuota?.total || apiQuota.balance == null) return null;
    return Math.max(0, Math.min(100, (apiQuota.balance / apiQuota.total) * 100));
  }, [apiQuota]);

  const openDetail = async (user: UserSummary) => {
    setDetailUser(user);
    setTagInput("");
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/balance-records?userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      if (data.user) setDetailUser(data.user);
      setDetailRecords(data.records ?? []);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailUser(null);
    setDetailRecords([]);
    setTagInput("");
  };

  const loadWorkspace = async (user: UserSummary) => {
    setWorkspaceUser(user);
    setWorkspaceLoading(true);
    setProfile(null);
    setProjects([]);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/workspace`);
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile ?? null);
        setProjects(data.projects ?? []);
      }
    } finally {
      setWorkspaceLoading(false);
    }
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
      setUsers((prev) => prev.map((u) => (u.id === detailUser.id ? { ...u, tags: nextTags } : u)));
      setAllTags((prev) => [...new Set([...prev, ...nextTags])].sort());
      setTagInput("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存标签失败");
    } finally {
      setSavingTags(false);
    }
  };

  const adjustBalance = async () => {
    if (!adjustTarget || !amount || !remark) return alert("请填写完整");
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: adjustTarget.id,
        amount: Number(amount),
        remark,
      }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error?.message ?? "失败");
    setAmount("");
    setRemark("");
    setAdjustTarget(null);
    loadOverview();
    if (detailUser?.id === adjustTarget.id) openDetail(adjustTarget);
  };

  const toggleStatus = async (user: UserSummary) => {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
      }),
    });
    loadOverview();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        用户画像与项目记忆仅供客服、运营与风控使用。请在隐私政策中告知用户相关数据查看范围。
      </div>

      {/* API 额度 */}
      <section className="rounded-2xl border bg-gradient-to-r from-gray-900 via-gray-800 to-indigo-900 text-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Wallet size={16} />
              QuickRouter 账户余额
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {apiQuota?.available
                ? formatMoney(apiQuota.balance, apiQuota.currency || "CNY")
                : (apiQuota?.error ?? "暂不可用")}
            </div>
            {apiQuota?.available && apiQuota.used != null && (
              <div className="mt-1 text-sm text-white/60">
                历史消耗 {formatMoney(apiQuota.used, apiQuota.currency || "CNY")}
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              setRefreshingQuota(true);
              await loadOverview();
              setRefreshingQuota(false);
            }}
            disabled={refreshingQuota}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          >
            <RefreshCw size={16} className={refreshingQuota ? "animate-spin" : ""} />
            刷新
          </button>
        </div>
        {quotaPercent != null && (
          <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${quotaPercent}%` }} />
          </div>
        )}
      </section>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">用户管理</h2>
          <p className="text-sm text-gray-500">账户、余额流水、标签与用户画像统一管理</p>
        </div>
        <div className="flex rounded-xl border bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
              viewMode === "list" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <List size={16} />
            列表
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
              viewMode === "cards" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <LayoutGrid size={16} />
            身份牌
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索邮箱或昵称"
          className="px-4 py-2 border rounded-xl flex-1 min-w-[200px] max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setSort(o.key)}
              className={`rounded-full px-3 py-1.5 text-sm border ${
                sort === o.key
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">标签：</span>
          <button
            onClick={() => setTagFilter("")}
            className={`rounded-full px-3 py-1 text-xs border ${
              !tagFilter ? "bg-gray-900 text-white" : "bg-white text-gray-600"
            }`}
          >
            全部
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag)}
              className={`rounded-full px-3 py-1 text-xs border ${
                tagFilter === tag ? "bg-indigo-600 text-white" : tagColor(tag)
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-gray-500">暂无用户</div>
      ) : viewMode === "list" ? (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">用户</th>
                <th className="px-4 py-3 text-left">注册时间</th>
                <th className="px-4 py-3 text-left">余额</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">调用</th>
                <th className="px-4 py-3 text-left">总消耗</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.nickname || "—"}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                    {u.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {u.tags.map((t) => (
                          <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${tagColor(t)}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                    {formatRegisterTime(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-indigo-600">{u.balance} 点</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        u.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {u.status === "ACTIVE" ? "正常" : "禁用"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{u.usageCount}</td>
                  <td className="px-4 py-3">{u.totalConsumed} 点</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      <button onClick={() => openDetail(u)} className="text-indigo-600 hover:underline">
                        流水
                      </button>
                      <button onClick={() => loadWorkspace(u)} className="text-indigo-600 hover:underline">
                        画像
                      </button>
                      <button onClick={() => setAdjustTarget(u)} className="text-indigo-600 hover:underline">
                        改额
                      </button>
                      <button onClick={() => toggleStatus(u)} className="text-gray-600 hover:underline">
                        {u.status === "ACTIVE" ? "禁用" : "启用"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`bg-gradient-to-br ${avatarGradient(u.email)} px-4 py-5 text-white`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold border-2 border-white/40">
                    {(u.nickname?.[0] ?? u.email[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{u.nickname || "未命名用户"}</div>
                    <div className="text-xs text-white/80 truncate">{u.email}</div>
                    <div className="text-[10px] text-white/60 mt-1">
                      注册于 {formatRegisterTime(u.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                      u.status === "ACTIVE" ? "bg-white/20" : "bg-black/20"
                    }`}
                  >
                    {u.status === "ACTIVE" ? "正常" : "禁用"}
                  </span>
                </div>
              </div>

              <div className="px-4 py-4">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-indigo-600">{u.balance}</div>
                  <div className="text-xs text-gray-400 mt-0.5">剩余点数</div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                  <div className="rounded-lg bg-gray-50 py-2">
                    <div className="font-medium">{u.usageCount}</div>
                    <div className="text-gray-400">调用</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 py-2">
                    <div className="font-medium">{u.totalConsumed}</div>
                    <div className="text-gray-400">消耗</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 py-2">
                    <div className="font-medium">
                      {new Date(u.lastActiveAt).toLocaleDateString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                      })}
                    </div>
                    <div className="text-gray-400">活跃</div>
                  </div>
                </div>

                {u.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {u.tags.map((t) => (
                      <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full border ${tagColor(t)}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openDetail(u)}
                    className="text-xs py-2 rounded-lg border hover:bg-gray-50"
                  >
                    流水详情
                  </button>
                  <button
                    onClick={() => loadWorkspace(u)}
                    className="text-xs py-2 rounded-lg border hover:bg-gray-50"
                  >
                    画像/项目
                  </button>
                  <button
                    onClick={() => setAdjustTarget(u)}
                    className="text-xs py-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  >
                    改额度
                  </button>
                  <button
                    onClick={() => toggleStatus(u)}
                    className="text-xs py-2 rounded-lg border hover:bg-gray-50"
                  >
                    {u.status === "ACTIVE" ? "禁用" : "启用"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 流水详情侧栏 */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={closeDetail}>
          <div
            className="h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold">{detailUser.nickname || detailUser.email}</h3>
                <p className="text-sm text-gray-500">{detailUser.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  注册于 {formatRegisterTime(detailUser.createdAt)}
                </p>
              </div>
              <button onClick={closeDetail} className="rounded-lg p-2 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Wallet size={16} /> 余额
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{detailUser.balance} 点</div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Activity size={16} /> 总消耗
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{detailUser.totalConsumed}</div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock3 size={16} /> 调用
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{detailUser.usageCount}</div>
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag size={16} /> 用户标签
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {detailUser.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${tagColor(tag)}`}
                    >
                      {tag}
                      <button onClick={() => saveTags(detailUser.tags.filter((t) => t !== tag))}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveTags([...new Set([...detailUser.tags, tagInput.trim()])]))}
                    placeholder="添加标签"
                    className="flex-1 rounded-xl border px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => tagInput.trim() && saveTags([...new Set([...detailUser.tags, tagInput.trim()])])}
                    disabled={savingTags || !tagInput.trim()}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                  >
                    添加
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => loadWorkspace(detailUser)}
                  className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50"
                >
                  查看画像/项目
                </button>
                <button
                  onClick={() => setAdjustTarget(detailUser)}
                  className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white"
                >
                  调整余额
                </button>
              </div>

              <div className="rounded-2xl border overflow-hidden">
                <div className="border-b px-4 py-3 font-medium">余额流水</div>
                {detailLoading ? (
                  <div className="p-6 text-gray-500">加载中...</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">时间</th>
                        <th className="px-4 py-2 text-left">类型</th>
                        <th className="px-4 py-2 text-left">变动</th>
                        <th className="px-4 py-2 text-left">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRecords.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-4 py-2 whitespace-nowrap text-xs">
                            {new Date(r.createdAt).toLocaleString("zh-CN")}
                          </td>
                          <td className="px-4 py-2">{TYPE_LABEL[r.changeType] ?? r.changeType}</td>
                          <td className={`px-4 py-2 ${r.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {r.amount > 0 ? `+${r.amount}` : r.amount}
                          </td>
                          <td className="px-4 py-2 text-gray-500">{r.remark ?? "—"}</td>
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

      {/* 画像弹窗 */}
      {workspaceUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between">
              <h3 className="text-lg font-semibold">用户画像 — {workspaceUser.email}</h3>
              <button onClick={() => setWorkspaceUser(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              {workspaceLoading ? (
                <p className="text-sm text-gray-500">加载中...</p>
              ) : (
                <>
                  {profile ? (
                    <div className="space-y-3">
                      <ProfileField label="身份概括" value={profile.identitySummary} />
                      <ProfileField label="输出偏好" value={profile.outputPreference} />
                      <ProfileField label="常见任务" value={profile.commonTasks} />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4">暂无画像</p>
                  )}
                  {projects.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium text-sm">项目 ({projects.length})</p>
                      {projects.map((p) => (
                        <div key={p.id} className="border rounded-lg p-3 text-sm">
                          <p className="font-medium">{p.name}</p>
                          {p.summary && <p className="text-gray-500 mt-1">{p.summary}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 改额度 */}
      {adjustTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">调整余额 — {adjustTarget.email}</h3>
            <p className="text-sm text-gray-500 mb-4">当前：{adjustTarget.balance} 点</p>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="变动点数"
              className="w-full px-4 py-2 border rounded-xl mb-3"
            />
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="备注（必填）"
              className="w-full px-4 py-2 border rounded-xl mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setAdjustTarget(null)} className="px-4 py-2 rounded-lg hover:bg-gray-100">
                取消
              </button>
              <button onClick={adjustBalance} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
