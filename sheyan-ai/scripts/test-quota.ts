import { readFileSync } from "fs";
import { fetchQuickRouterQuota } from "../src/lib/quickrouter-quota";

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
  const q = await fetchQuickRouterQuota();
  console.log(JSON.stringify(q, null, 2));
}

main();
