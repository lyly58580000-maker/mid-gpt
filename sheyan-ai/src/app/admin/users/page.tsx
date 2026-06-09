"use client";

import { useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  nickname: string | null;
  balance: number;
  status: string;
  createdAt: string;
  _count: { usageRecords: number };
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");

  const load = async () => {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setUsers(data.users ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const adjustBalance = async () => {
    if (!selected || !amount || !remark) return alert("请填写完整");
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selected.id, amount: Number(amount), remark }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error?.message ?? "失败");
    setAmount("");
    setRemark("");
    setSelected(null);
    load();
  };

  const toggleStatus = async (user: User) => {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
      }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索邮箱或昵称"
          className="px-4 py-2 border rounded-xl flex-1 max-w-md"
        />
        <button onClick={load} className="px-4 py-2 bg-indigo-600 text-white rounded-xl">
          搜索
        </button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">邮箱</th>
              <th className="px-4 py-3 text-left">昵称</th>
              <th className="px-4 py-3 text-left">余额</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">调用次数</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.nickname}</td>
                <td className="px-4 py-3 font-medium">{u.balance} 点</td>
                <td className="px-4 py-3">{u.status === "ACTIVE" ? "正常" : "禁用"}</td>
                <td className="px-4 py-3">{u._count.usageRecords}</td>
                <td className="px-4 py-3 space-x-2">
                  <button onClick={() => setSelected(u)} className="text-indigo-600 hover:underline">
                    改额度
                  </button>
                  <button onClick={() => toggleStatus(u)} className="text-gray-600 hover:underline">
                    {u.status === "ACTIVE" ? "禁用" : "启用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">调整余额 — {selected.email}</h3>
            <p className="text-sm text-gray-500 mb-4">当前余额：{selected.balance} 点</p>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="变动点数（正数增加，负数扣除）"
              className="w-full px-4 py-2 border rounded-xl mb-3"
            />
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="备注（必填，如：微信转账30元）"
              className="w-full px-4 py-2 border rounded-xl mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-lg hover:bg-gray-100">
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
