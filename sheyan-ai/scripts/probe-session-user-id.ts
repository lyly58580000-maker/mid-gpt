import { readFileSync } from "fs";

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

const session = process.env.QUICKROUTER_ACCESS_TOKEN ?? "";
const buf = Buffer.from(session, "base64");

async function tryId(id: number) {
  const res = await fetch("https://api.quickrouter.ai/api/user/self", {
    headers: {
      Accept: "application/json",
      Cookie: `session=${session}`,
      "new-api-user": String(id),
    },
  });
  const text = await res.text();
  if (res.status === 200 && text.includes('"success":true')) {
    const data = JSON.parse(text) as { data?: { quota?: number; used_quota?: number; id?: number } };
    console.log("MATCH_USER_ID", id);
    console.log("api_id", data.data?.id);
    console.log("quota_units", data.data?.quota);
    console.log("used_units", data.data?.used_quota);
    if (data.data?.quota != null) {
      console.log("balance_cny", data.data.quota / 500_000);
    }
    if (data.data?.used_quota != null) {
      console.log("used_cny", data.data.used_quota / 500_000);
    }
    return true;
  }
  console.log("fail", id, res.status, text.slice(0, 100));
  return false;
}

async function main() {
  console.log("session_bytes", buf.length);
  const candidates = new Set<number>();
  for (let i = 0; i < buf.length - 3; i++) {
    for (const read of [(b: Buffer, o: number) => b.readUInt32LE(o), (b: Buffer, o: number) => b.readUInt32BE(o)]) {
      const v = read(buf, i);
      if (v > 10_000 && v < 2_000_000) candidates.add(v);
    }
  }
  candidates.add(Number(process.env.QUICKROUTER_USER_ID));
  candidates.add(581045);

  for (const id of [...candidates].sort((a, b) => a - b)) {
    if (await tryId(id)) return;
  }
}

main();
