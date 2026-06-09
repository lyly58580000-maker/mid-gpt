import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_CONFIGS = [
  { configKey: "text_enabled", configValue: "true", description: "文本对话开关" },
  { configKey: "image_enabled", configValue: "true", description: "生图开关" },
  { configKey: "register_enabled", configValue: "true", description: "新用户注册开关" },
  { configKey: "recharge_enabled", configValue: "true", description: "充值入口开关" },
  { configKey: "maintenance_mode", configValue: "false", description: "维护模式" },
  { configKey: "text_charge_points", configValue: "1", description: "文本扣点" },
  { configKey: "image_charge_points", configValue: "5", description: "生图扣点" },
  { configKey: "register_welcome_points", configValue: "20", description: "新用户注册赠送点数" },
];

async function upsertUser(
  email: string,
  password: string,
  role: UserRole,
  balance: number,
  nickname: string,
) {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role, balance, nickname, status: "ACTIVE" },
    create: { email, passwordHash, role, balance, nickname },
  });

  const existingDefault = await prisma.chatGroup.findFirst({
    where: { userId: user.id, isDefault: true },
  });

  if (!existingDefault) {
    await prisma.chatGroup.create({
      data: { userId: user.id, name: "默认分组", isDefault: true, sortOrder: 0 },
    });
  }

  return user;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@sheyan.ai";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "SheyanAdmin2026!";
  const demoEmail = process.env.SEED_DEMO_EMAIL ?? "demo@sheyan.ai";
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "SheyanDemo2026!";
  const demoBalance = Number(process.env.SEED_DEMO_BALANCE ?? 100);

  await upsertUser(adminEmail, adminPassword, UserRole.ADMIN, 0, "超级管理员");
  await upsertUser(demoEmail, demoPassword, UserRole.USER, demoBalance, "演示用户");

  for (const config of DEFAULT_CONFIGS) {
    await prisma.systemConfig.upsert({
      where: { configKey: config.configKey },
      update: { configValue: config.configValue, description: config.description },
      create: config,
    });
  }

  console.log("Seed complete:");
  console.log(`  Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`  Demo:  ${demoEmail} / ${demoPassword} (${demoBalance} points)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
