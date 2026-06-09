"use client";

import { useEffect, useState } from "react";
import { Users, Activity, CreditCard, Server } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function AdminDashboardPage() {
  const [data, setData] = useState<{
    stats: {
      totalUsers: number;
      todayUsers: number;
      todayUsage: number;
      todayText: number;
      todayImage: number;
      todayPoints: number;
      totalBalance: number;
    };
    chartData: { name: string; calls: number }[];
    modelStats: { modelName: string; count: number; points: number }[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className="text-gray-500">加载中...</div>;

  const cards = [
    { title: "总用户数", value: data.stats.totalUsers, sub: `+${data.stats.todayUsers}`, icon: Users },
    { title: "今日调用", value: data.stats.todayUsage, sub: `文本${data.stats.todayText}/生图${data.stats.todayImage}`, icon: Activity },
    { title: "今日消耗点数", value: data.stats.todayPoints, sub: "点", icon: CreditCard },
    { title: "用户剩余总点数", value: data.stats.totalBalance, sub: "点", icon: Server },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="flex justify-between mb-4">
                <div className="text-sm text-gray-500">{card.title}</div>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Icon size={20} />
                </div>
              </div>
              <div className="text-3xl font-semibold">{card.value}</div>
              <div className="text-sm text-gray-400 mt-1">{card.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm h-[360px]">
        <h3 className="font-semibold mb-4">近 7 天调用趋势</h3>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={data.chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="calls" stroke="#4F46E5" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b font-semibold">模型使用统计</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">模型</th>
              <th className="px-6 py-3 text-left">调用次数</th>
              <th className="px-6 py-3 text-left">消耗点数</th>
            </tr>
          </thead>
          <tbody>
            {data.modelStats.map((m) => (
              <tr key={m.modelName} className="border-t">
                <td className="px-6 py-3 text-indigo-600">{m.modelName}</td>
                <td className="px-6 py-3">{m.count}</td>
                <td className="px-6 py-3">{m.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
