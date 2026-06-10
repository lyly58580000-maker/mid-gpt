type QuotaPayload = {
  balance?: number;
  total?: number;
  used?: number;
  remain?: number;
  quota?: number;
  data?: Record<string, unknown>;
};

/** QuickRouter / New API 内部额度单位：50 万 = 1 元 */
const QUOTA_UNITS_PER_CNY = 500_000;
const API_BASE = "https://api.quickrouter.ai";

export type ApiQuotaInfo = {
  available: boolean;
  balance: number | null;
  total: number | null;
  used: number | null;
  unlimited?: boolean;
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

function toCnyQuota(value: unknown): number | null {
  const units = pickNumber(value);
  if (units == null) return null;
  return units / QUOTA_UNITS_PER_CNY;
}

function unavailable(error: string, updatedAt: string): ApiQuotaInfo {
  return {
    available: false,
    balance: null,
    total: null,
    used: null,
    currency: "CNY",
    source: "quickrouter",
    updatedAt,
    error,
  };
}

async function fetchJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
    cache: "no-store",
  });

  const text = await res.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (!res.ok) {
      throw new Error(`${res.status} ${text.slice(0, 120)}`);
    }
    return text;
  }
}

type AccountAuth = {
  token: string;
  userId: string;
};

async function loginQuickRouter(): Promise<AccountAuth | null> {
  const username = process.env.QUICKROUTER_USERNAME?.trim();
  const password = process.env.QUICKROUTER_PASSWORD;
  if (!username || !password) return null;

  const res = await fetch(`${API_BASE}/api/user/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  const data = (await res.json()) as {
    success?: boolean;
    message?: string;
    data?: { token?: string; user?: { id?: number }; require_2fa?: boolean };
  };

  if (!data.success) {
    throw new Error(data.message ?? "QuickRouter 登录失败");
  }
  if (data.data?.require_2fa) {
    throw new Error("QuickRouter 账号开启了两步验证，请改用 QUICKROUTER_ACCESS_TOKEN");
  }
  if (!data.data?.token) {
    throw new Error("QuickRouter 登录未返回 access token");
  }

  const userId = String(data.data.user?.id ?? process.env.QUICKROUTER_USER_ID?.trim() ?? "");
  if (!userId) {
    throw new Error("登录成功但未获取用户 ID，请配置 QUICKROUTER_USER_ID");
  }

  return { token: data.data.token, userId };
}

async function resolveAccountAuth(): Promise<AccountAuth | null> {
  const accessToken = process.env.QUICKROUTER_ACCESS_TOKEN?.trim();
  const userId = process.env.QUICKROUTER_USER_ID?.trim();
  if (accessToken && userId) {
    return { token: accessToken, userId };
  }
  return loginQuickRouter();
}

function parseAccountSelf(payload: unknown): Pick<ApiQuotaInfo, "balance" | "total" | "used"> | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  if (root.success === false) {
    throw new Error(typeof root.message === "string" ? root.message : "账户信息查询失败");
  }

  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : (root as Record<string, unknown>);

  const quotaUnits = pickNumber(data.quota);
  const usedUnits = pickNumber(data.used_quota);
  if (quotaUnits == null && usedUnits == null) return null;

  // New API：quota = 当前剩余额度，used_quota = 历史消耗（与控制台钱包一致）
  const balance = quotaUnits != null ? toCnyQuota(quotaUnits) : null;
  const used = usedUnits != null ? toCnyQuota(usedUnits) : null;
  const total =
    balance != null && used != null ? balance + used : balance != null ? balance : used;

  return { balance, total, used };
}

async function fetchAccountWallet(auth: AccountAuth) {
  const userHeader = { "new-api-user": auth.userId };
  const attempts: Record<string, string>[] = [
    { Cookie: `session=${auth.token}`, ...userHeader },
    { Authorization: `Bearer ${auth.token}`, ...userHeader },
  ];

  let lastError = "账户信息查询失败";
  for (const headers of attempts) {
    try {
      const payload = await fetchJson(`${API_BASE}/api/user/self`, headers);
      const parsed = parseAccountSelf(payload);
      if (parsed) return parsed;
    } catch (err) {
      const message = err instanceof Error ? err.message : lastError;
      if (message.includes("does not match")) {
        throw new Error(
          "session 与 QUICKROUTER_USER_ID 不匹配。请在 Network → self 请求的「请求标头」里复制 new-api-user 的准确值",
        );
      }
      lastError = message;
    }
  }

  throw new Error(lastError);
}

function parseTokenUsagePayload(
  payload: unknown,
): Pick<ApiQuotaInfo, "balance" | "total" | "used" | "unlimited"> | null {
  if (!payload || typeof payload !== "object") return null;

  const nested =
    (payload as QuotaPayload).data && typeof (payload as QuotaPayload).data === "object"
      ? ((payload as QuotaPayload).data as Record<string, unknown>)
      : null;
  if (!nested) return null;

  const unlimited = nested.unlimited_quota === true;
  const used = toCnyQuota(nested.total_used);
  const total = toCnyQuota(nested.total_granted);
  const available = toCnyQuota(nested.total_available);

  if (unlimited) {
    return { balance: null, total: null, used, unlimited: true };
  }

  let balance = available;
  if (balance != null && balance < 0) balance = 0;
  if (balance == null && total != null && used != null) {
    balance = Math.max(0, total - used);
  }

  if (balance != null || total != null || used != null) {
    return { balance, total, used, unlimited: false };
  }

  return null;
}

export async function fetchQuickRouterQuota(): Promise<ApiQuotaInfo> {
  const updatedAt = new Date().toISOString();

  try {
    const auth = await resolveAccountAuth();
    if (auth) {
      const account = await fetchAccountWallet(auth);
      if (account && (account.balance != null || account.used != null)) {
        return {
          available: true,
          balance: account.balance,
          total: account.total,
          used: account.used,
          currency: "CNY",
          source: "account-wallet",
          updatedAt,
        };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "账户余额查询失败";
    const hasAuthConfig = Boolean(
      process.env.QUICKROUTER_ACCESS_TOKEN ||
        (process.env.QUICKROUTER_USERNAME && process.env.QUICKROUTER_PASSWORD),
    );
    if (hasAuthConfig) {
      return unavailable(message, updatedAt);
    }
  }

  const apiKey = process.env.TEXT_API_KEY ?? process.env.IMAGE_API_KEY;
  if (!apiKey) {
    return unavailable(
      "未配置账户凭证。请在 .env.local 添加 QUICKROUTER_ACCESS_TOKEN + QUICKROUTER_USER_ID（QuickRouter 登录后从浏览器获取），或配置 QUICKROUTER_USERNAME + QUICKROUTER_PASSWORD",
      updatedAt,
    );
  }

  try {
    const payload = await fetchJson(`${API_BASE}/api/usage/token/`, {
      Authorization: `Bearer ${apiKey}`,
    });
    const tokenUsage = parseTokenUsagePayload(payload);
    if (tokenUsage?.unlimited) {
      return unavailable(
        "当前仅配置了 API 令牌，无法读取账户钱包。请在 .env.local 配置 QUICKROUTER_ACCESS_TOKEN 与 QUICKROUTER_USER_ID 以同步人民币余额",
        updatedAt,
      );
    }
    if (tokenUsage && (tokenUsage.balance != null || tokenUsage.used != null)) {
      return {
        available: true,
        balance: tokenUsage.balance,
        total: tokenUsage.total,
        used: tokenUsage.used,
        currency: "CNY",
        source: "usage-token",
        updatedAt,
      };
    }
  } catch (err) {
    return unavailable(err instanceof Error ? err.message : "额度查询失败", updatedAt);
  }

  return unavailable("无法解析 QuickRouter 额度响应", updatedAt);
}
