import { readFileSync } from "fs";
import { buildChatMessages, generateTextReply } from "../src/lib/ai/text-provider";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0 && !line.startsWith("#")) {
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function main() {
  const messages = await buildChatMessages([], "你好，用一句话介绍你自己");
  const result = await generateTextReply(messages);
  console.log("model:", result.modelName);
  console.log("reply:", result.text);
}

main().catch((e) => {
  console.error("ERR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
