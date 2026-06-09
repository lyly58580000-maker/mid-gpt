"use client";

import { useEffect, useState } from "react";

export default function ImageLogsPage() {
  const [records, setRecords] = useState<
    {
      id: string;
      modelName: string;
      costPoints: number;
      status: string;
      createdAt: string;
      user: { email: string };
    }[]
  >([]);

  useEffect(() => {
    fetch("/api/admin/logs?type=image")
      .then((r) => r.json())
      .then((d) => setRecords(d.records ?? []));
  }, []);

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left">时间</th>
            <th className="px-4 py-3 text-left">用户</th>
            <th className="px-4 py-3 text-left">模型</th>
            <th className="px-4 py-3 text-left">消耗</th>
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
              <td className="px-4 py-3">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
