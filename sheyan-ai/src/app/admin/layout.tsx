"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  Menu,
  X,
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (pathname === "/admin/login") return <>{children}</>;

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const pageTitle = navItems.find((n) => n.href === pathname)?.label ?? "管理后台";

  const sidebar = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-gray-800 px-4 md:px-6">
        <div className="flex items-center min-w-0">
          <div className="mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">
            设
          </div>
          <span className="truncate text-lg font-bold text-white">设研AI 控制台</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="rounded-lg p-2 text-gray-400 hover:text-white md:hidden"
          aria-label="关闭菜单"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4 md:py-6">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileNavOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                active ? "bg-indigo-600 text-white" : "hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-800 p-4">
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <LogOut size={16} /> 退出系统
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#F7F7F8]">
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="关闭菜单"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto flex h-[100dvh] w-[min(100vw,16rem)] md:w-64 flex-shrink-0 flex-col bg-gray-900 text-gray-300 transition-transform duration-300 ease-out ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 md:h-16 flex-shrink-0 items-center gap-3 border-b bg-white px-4 pr-14 md:px-8 md:pr-8 shadow-sm">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label="打开菜单"
          >
            <Menu size={20} />
          </button>
          <h1 className="truncate text-lg md:text-xl font-semibold text-gray-800">{pageTitle}</h1>
        </header>
        <main className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
