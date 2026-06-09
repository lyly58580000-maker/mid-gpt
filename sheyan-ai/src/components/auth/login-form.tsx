"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function LoginForm({ portal }: { portal: "user" | "admin" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = isRegister && portal === "user" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password, portal }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
        redirectTo?: string;
      };
      if (!res.ok) throw new Error(data.error?.message ?? `登录失败 (${res.status})`);

      const dest = data.redirectTo ?? (portal === "admin" ? "/admin" : "/chat");
      window.location.assign(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-semibold text-gray-900 tracking-tight">
          设研AI
        </h2>
        {portal === "admin" && (
          <p className="mt-2 text-center text-sm text-gray-500">管理控制台</p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-2xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={submit}>
            {error && (
              <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
            )}
            <input
              type="email"
              required
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
            />
            <input
              type="password"
              required
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70"
            >
              {loading ? <RefreshCw className="animate-spin h-5 w-5" /> : isRegister ? "注册并登录" : "登录"}
            </button>
          </form>

          {portal === "admin" && (
            <p className="mt-6 text-center text-xs text-gray-500 leading-relaxed">
              预置管理员：admin@sheyan.ai / SheyanAdmin2026!
              <br />
              请使用 <span className="font-medium text-gray-700">http://127.0.0.1:3000/admin/login</span> 访问
            </p>
          )}

          {portal === "user" && (
            <div className="mt-6 text-center space-y-3">
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-indigo-600 hover:underline"
              >
                {isRegister ? "已有账号？去登录" : "没有账号？注册"}
              </button>
              <p className="text-xs text-gray-500">
                登录即表示同意用户协议与隐私政策
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
