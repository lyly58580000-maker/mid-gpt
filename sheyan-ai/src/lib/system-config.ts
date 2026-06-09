import { prisma } from "@/lib/prisma";

export async function getConfig(key: string, fallback = ""): Promise<string> {
  const row = await prisma.systemConfig.findUnique({ where: { configKey: key } });
  return row?.configValue ?? fallback;
}

export async function getConfigBool(key: string, fallback = false): Promise<boolean> {
  const value = await getConfig(key, fallback ? "true" : "false");
  return value === "true";
}

export async function getChargePoints(type: "text" | "image"): Promise<number> {
  const key = type === "text" ? "text_charge_points" : "image_charge_points";
  const envKey = type === "text" ? "TEXT_CHARGE_POINTS" : "IMAGE_CHARGE_POINTS";
  const envVal = process.env[envKey];
  if (envVal) return Number(envVal);
  return Number(await getConfig(key, type === "text" ? "1" : "5"));
}

export async function setConfig(key: string, value: string) {
  return prisma.systemConfig.upsert({
    where: { configKey: key },
    update: { configValue: value },
    create: { configKey: key, configValue: value },
  });
}

export async function getAllConfigs() {
  return prisma.systemConfig.findMany({ orderBy: { configKey: "asc" } });
}
