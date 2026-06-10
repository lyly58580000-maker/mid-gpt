import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  if (line.startsWith("DATABASE_URL=") && !line.includes("UNPOOLED")) {
    process.env.DATABASE_URL = line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
    break;
  }
}

const prisma = new PrismaClient();

async function main() {
  const [modes, templates, projects] = await Promise.all([
    prisma.answerMode.count(),
    prisma.sceneTemplate.count(),
    prisma.project.count(),
  ]);
  console.log(JSON.stringify({ answerModes: modes, sceneTemplates: templates, projects }, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
