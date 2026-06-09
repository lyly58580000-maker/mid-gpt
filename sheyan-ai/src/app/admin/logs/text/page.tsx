"use client";

import { useEffect, useState } from "react";

function LogsTable({ type }: { type: "text" | "image" }) {
  const [records, setRecords] = useState<
    {
      id: string;
      modelName: string;
      costPoints: number;
      status: string;
      totalTokens: number | null;
      createdAt: string;
      user: { email: string };
    }[]
  >([]);

  useEffect(() => {
    fetch(`/api/admin/logs?type=${type}`)
      .then((r) => r.json())
      .then((d) => setRecords(d.records ?? []));
  }, [type]);

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left">时间</th>
            <th className="px-4 py-3 text-left">用户</th>
            <th className="px-4 py-3 text-left">模型</th>
            <th className="px-4 py-3 text-left">消耗</th>
            <th className="px-4 py-3 text-left">Tokens</th>
            <th className="px-4 py-3 text-left">状态</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-4 py-3">{new Date(r.createdAt).toLocaleString("zh-CN")}</td>
              <td className="px-4 py-3">{r.user.email}</td>
              <td className="px-4 py-3">{r.modelName}</td>
              <td className="px-4 py-3">{r.costPoints} 点</td>
              <td className="px-4 py-3">{r.totalTokens ?? "-"}</td>
              <td className="px-4 py-3">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TextLogsPage() {
  return <LogsTable type="text" />;
}
