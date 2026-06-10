"use client";

import { usePathname } from "next/navigation";
import { isBetaFeedbackEnabled } from "@/features/beta-feedback/config";
import { BetaFeedbackWidget } from "@/features/beta-feedback/components/BetaFeedbackWidget";

/** 唯一对外挂载点：在 layout 中引入此组件即可 */
export function BetaFeedbackMount() {
  const pathname = usePathname();
  if (!isBetaFeedbackEnabled()) return null;
  if (pathname.startsWith("/admin")) return null;
  return <BetaFeedbackWidget />;
}
