"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Image as ImageIcon,
  Server,
  Settings,
  LogOut,
  BarChart3,
  MessageSquareWarning,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "总控仪表盘", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "用量分析", icon: BarChart3 },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/logs/text", label: "调用日志", icon: FileText },
  { href: "/admin/logs/image", label: "生图日志", icon: ImageIcon },
  { href: "/admin/models", label: "模型配置", icon: Server },
  { href: "/admin/settings", label: "系统开关", icon: Settings },
  { href: "/admin/beta-feedback", label: "灰度反馈", icon: MessageSquareWarning },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") return <>{children}</>;

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <div className="flex h-screen bg-[#F7F7F8]">
      <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-800">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mr-3 text-white font-bold">设</div>
          <span className="text-lg font-bold text-white">设研AI 控制台</span>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${
                  active ? "bg-indigo-600 text-white" : "hover:bg-gray-800 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl"
          >
            <LogOut size={16} /> 退出系统
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center px-8 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-800">
            {navItems.find((n) => n.href === pathname)?.label ?? "管理后台"}
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
