import { getConfig } from "@/lib/system-config";

/** QuickRouter 充值折扣系数：9.90 折 = 0.99（实付/面值） */
export async function getQuickRouterRechargeDiscount(): Promise<number> {
  const raw = await getConfig("quickrouter_recharge_discount", "0.99");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.99;
}

export async function getApiCostPer1kTokens(): Promise<number> {
  const raw = await getConfig("api_cost_cny_per_1k_tokens", "0.0067");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0.0067;
}

export async function getApiCostPerImage(): Promise<number> {
  const raw = await getConfig("api_cost_image_cny", "0.41");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0.41;
}

export async function estimateApiCostCny(params: {
  usageType: "text" | "image";
  totalTokens?: number | null;
}): Promise<number> {
  const discount = await getQuickRouterRechargeDiscount();
  if (params.usageType === "image") {
    return (await getApiCostPerImage()) * discount;
  }
  const tokens = params.totalTokens ?? 0;
  if (tokens <= 0) return 0;
  return (tokens / 1000) * (await getApiCostPer1kTokens()) * discount;
}
