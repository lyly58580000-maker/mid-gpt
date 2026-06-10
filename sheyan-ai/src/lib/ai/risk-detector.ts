const RISK_KEYWORDS = [
  "专利",
  "法律",
  "医疗",
  "金融",
  "投资",
  "政策",
  "价格",
  "api",
  "模型能力",
  "最新",
  "今天",
  "现在",
  "合规",
  "是否可行",
  "是否侵权",
  "能不能申请",
  "有没有风险",
  "侵权",
  "违法",
  "税率",
  "贷款",
  "股价",
];

export function detectRiskTopics(text: string): boolean {
  const lower = text.toLowerCase();
  return RISK_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

export const UNCERTAINTY_INSTRUCTION = `本问题涉及可能变化、需要验证或存在专业边界的信息。回答时必须说明：
1. 当前判断；
2. 前提条件；
3. 不确定点；
4. 建议用户进一步验证的事项；
5. 不得做绝对化承诺。`;

export const SKIP_MEMORY_PATTERNS = [
  /不要结合历史/,
  /别结合历史/,
  /忽略之前/,
  /Forget/i,
];

export const FORGET_MEMORY_PATTERNS = [
  /忘记(?:关于|之前)?(.{2,40})/,
  /删除记忆[：:]\s*(.+)/,
  /不要记住(.+)/,
];

export function shouldSkipMemory(text: string): boolean {
  return SKIP_MEMORY_PATTERNS.some((p) => p.test(text));
}

export function extractForgetTarget(text: string): string | null {
  for (const pattern of FORGET_MEMORY_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}
