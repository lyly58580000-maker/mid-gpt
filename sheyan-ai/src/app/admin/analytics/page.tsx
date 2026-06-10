"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

type Analytics = {
  days: number;
  summary: {
    totalCalls: number;
    totalPoints: number;
    totalEstimatedApiCostCny: number;
    activeUsers: number;
    avgCallsPerActiveUserPerDay: number;
    avgPointsPerCall: number;
    avgApiCostPerPoint: number;
  };
  daily: { date: string; calls: number; points: number; apiCostCny: number; activeUsers: number }[];
  users: {
    userId: string;
    email: string;
    nickname: string | null;
    balance: number;
    registeredDays: number;
    calls7d: number;
    points7d: number;
    avgCallsPerDay7d: number;
    calls30d: number;
    points30d: number;
    apiCostCny30d: number;
    callsAll: number;
    pointsAll: number;
    lastActiveAt: string | null;
  }[];
};

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/usage-analytics?days=${days}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading || !data) {
    return <div className="text-gray-500">加载用量分析...</div>;
  }

  const { summary } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">用量与定价分析</h2>
          <p className="text-sm text-gray-500">记录对话频率、积分消耗与 API 成本，供灰度期动态调价参考</p>
        </div>
        <div className="flex rounded-xl border bg-white p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                days === d ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {d} 天
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "活跃用户数", value: summary.activeUsers },
          { label: "总调用次数", value: summary.totalCalls },
          { label: "消耗积分", value: `${summary.totalPoints} 点` },
          { label: "估算 API 成本", value: `¥${summary.totalEstimatedApiCostCny.toFixed(2)}` },
          { label: "人均日对话", value: summary.avgCallsPerActiveUserPerDay },
          { label: "单次均扣点", value: summary.avgPointsPerCall },
          { label: "每点 API 成本", value: `¥${summary.avgApiCostPerPoint.toFixed(4)}` },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border p-4">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border h-[320px]">
          <h3 className="font-semibold mb-4">每日对话次数</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="calls" name="调用" stroke="#4F46E5" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-2xl border h-[320px]">
          <h3 className="font-semibold mb-4">每日积分消耗</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="points" name="点数" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold">用户对话频率与积分消耗</h3>
          <p className="text-sm text-gray-500 mt-1">按近 {days} 天消耗排序</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">用户</th>
                <th className="px-4 py-3 text-right">7日对话</th>
                <th className="px-4 py-3 text-right">7日扣点</th>
                <th className="px-4 py-3 text-right">日均对话</th>
                <th className="px-4 py-3 text-right">{days}日对话</th>
                <th className="px-4 py-3 text-right">{days}日扣点</th>
                <th className="px-4 py-3 text-right">API成本</th>
                <th className="px-4 py-3 text-right">余额</th>
                <th className="px-4 py-3 text-left">最近活跃</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.users.map((u) => (
                <tr key={u.userId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.nickname ?? u.email.split("@")[0]}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{u.calls7d}</td>
                  <td className="px-4 py-3 text-right">{u.points7d}</td>
                  <td className="px-4 py-3 text-right">{u.avgCallsPerDay7d}</td>
                  <td className="px-4 py-3 text-right">{u.calls30d}</td>
                  <td className="px-4 py-3 text-right font-medium text-indigo-600">{u.points30d}</td>
                  <td className="px-4 py-3 text-right">¥{u.apiCostCny30d.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">{u.balance}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString("zh-CN") : "—"}
                  </td>
                </tr>
              ))}
              {data.users.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    暂无用量数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
