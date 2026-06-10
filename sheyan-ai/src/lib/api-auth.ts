import { getSession } from "@/lib/auth";
import { AppError } from "@/lib/billing";

export async function requireUserSession() {
  const session = await getSession();
  if (!session) throw new AppError("UNAUTHORIZED", "请先登录", 401);
  return session;
}
