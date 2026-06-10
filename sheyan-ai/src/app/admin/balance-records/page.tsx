import { redirect } from "next/navigation";

/** 已合并至用户管理，保留路由兼容旧链接 */
export default function BalanceRecordsRedirectPage() {
  redirect("/admin/users");
}
