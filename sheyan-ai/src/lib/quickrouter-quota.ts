type QuotaPayload = {
  balance?: number;
  total?: number;
  used?: number;
  remain?: number;
  quota?: number;
  data?: Record<string, unknown>;
};

export type ApiQuotaInfo = {
  available: boolean;
  balance: number | null;
  total: number | null;
  used: number | null;
  currency: string;
  source: string;
  updatedAt: string;
  error?: string;
};

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function parseQuotaPayload(payload: unknown): Pick<ApiQuotaInfo, "balance" | "total" | "used"> {
  if (typeof payload === "number") {
    return { balance: payload, total: null, used: null };
  }

  if (typeof payload === "string" && !Number.isNaN(Number(payload))) {
    return { balance: Number(payload), total: null, used: null };
  }

  if (!payload || typeof payload !== "object") {
    return { balance: null, total: null, used: null };
  }

  const root = payload as QuotaPayload;
  const nested =
    root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : {};

  const balance = pickNumber(
    root.balance,
    root.remain,
    nested.balance,
    nested.remain,
    nested.remaining,
    nested.remaining_quota,
  );

  const total = pickNumber(root.total, root.quota, nested.total, nested.quota, nested.total_quota);
  const used = pickNumber(root.used, nested.used, nested.used_quota, nested.usage);

  if (balance != null && total != null && used == null) {
    return { balance, total, used: Math.max(0, total - balance) };
  }

  if (total != null && used != null && balance == null) {
    return { balance: Math.max(0, total - used), total, used };
  }

  return { balance, total, used };
}

async function fetchJson(url: string, apiKey: string) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${text.slice(0, 120)}`);
  }

  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function fetchQuickRouterQuota(): Promise<ApiQuotaInfo> {
  const apiKey = process.env.TEXT_API_KEY ?? process.env.IMAGE_API_KEY;
  const updatedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      available: false,
      balance: null,
      total: null,
      used: null,
      currency: "USD",
      source: "quickrouter",
      updatedAt,
      error: "未配置 TEXT_API_KEY",
    };
  }

  const endpoints = [
    { source: "balance", url: "https://api.quickrouter.ai/balance" },
    { source: "usage-token", url: "https://api.quickrouter.ai/api/usage/token/" },
  ];

  let lastError = "无法读取 QuickRouter 额度";

  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson(endpoint.url, apiKey);
      const parsed = parseQuotaPayload(payload);
      if (parsed.balance != null || parsed.total != null || parsed.used != null) {
        return {
          available: true,
          balance: parsed.balance,
          total: parsed.total,
          used: parsed.used,
          currency: "USD",
          source: endpoint.source,
          updatedAt,
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "额度查询失败";
    }
  }

  return {
    available: false,
    balance: null,
    total: null,
    used: null,
    currency: "USD",
    source: "quickrouter",
    updatedAt,
    error: lastError,
  };
}
