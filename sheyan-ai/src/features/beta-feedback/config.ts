/** 灰度反馈模块开关：设为 false 或删除整包即可下线 */
export function isBetaFeedbackEnabled() {
  return process.env.NEXT_PUBLIC_BETA_FEEDBACK_ENABLED === "true";
}

export const BETA_FEEDBACK_INTRO =
  "设研 AI 灰度上线！！请尽情骂我的产品（不要对我人格攻击），并且写出你发现的问题以及你希望的优化方向。";

/** 管理员标记已解决时可选的积分档位 */
export const BETA_FEEDBACK_REWARD_TIERS = {
  minor: {
    key: "minor",
    label: "小建议",
    points: 2,
    hint: "文案、样式、交互小细节",
  },
  normal: {
    key: "normal",
    label: "体验问题",
    points: 5,
    hint: "可复现但不阻断主流程",
  },
  major: {
    key: "major",
    label: "功能缺陷",
    points: 10,
    hint: "功能异常、逻辑错误、明显卡顿",
  },
  critical: {
    key: "critical",
    label: "高价值发现",
    points: 20,
    hint: "崩溃、数据丢失、安全/支付风险",
  },
} as const;

export type BetaFeedbackRewardTierKey = keyof typeof BETA_FEEDBACK_REWARD_TIERS;

export const BETA_FEEDBACK_MAX_IMAGES = 3;
export const BETA_FEEDBACK_CONTENT_MIN = 8;
export const BETA_FEEDBACK_CONTENT_MAX = 2000;
