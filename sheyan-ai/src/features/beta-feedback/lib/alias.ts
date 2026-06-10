import { createHash } from "crypto";

/** 稳定匿名代号，公开区不暴露 userId / 邮箱 */
export function buildPublicAlias(userId: string): string {
  const hash = createHash("sha256").update(`${userId}:beta-feedback`).digest("hex");
  return `内测用户 #${hash.slice(0, 4).toUpperCase()}`;
}
