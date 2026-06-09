import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";
import { isVercelRuntime } from "@/lib/runtime";

function getImageClient() {
  return new OpenAI({
    apiKey: process.env.IMAGE_API_KEY,
    baseURL: process.env.IMAGE_API_BASE_URL,
  });
}

async function persistImage(sourceUrl: string, prompt: string): Promise<string> {
  const dir = path.join(process.cwd(), "public", "generated");
  await fs.mkdir(dir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const filepath = path.join(dir, filename);

  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`下载图片失败: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(filepath, buffer);

  return `/generated/${filename}`;
}

async function persistBase64(b64: string): Promise<string> {
  const dir = path.join(process.cwd(), "public", "generated");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, Buffer.from(b64, "base64"));
  return `/generated/${filename}`;
}

function isRateLimited(err: unknown): boolean {
  const status =
    err && typeof err === "object" && "status" in err
      ? (err as { status?: number }).status
      : undefined;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    status === 429 ||
    /429|负载已饱和|rate.?limit|too many requests/i.test(msg)
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateImage(prompt: string): Promise<{ url: string; model: string }> {
  const client = getImageClient();
  const primaryModel = process.env.IMAGE_MODEL_NAME ?? "gpt-image-2";
  const fallbackModel = process.env.IMAGE_FALLBACK_MODEL?.trim();
  const models = [...new Set([primaryModel, fallbackModel].filter(Boolean))];
  const size = (process.env.IMAGE_SIZE ?? "1024x1024") as "1024x1024";
  const maxAttempts = 3;

  let lastError: Error | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await client.images.generate({
          model,
          prompt,
          size,
          n: 1,
        });

        const item = response.data?.[0];
        if (!item) throw new Error("未返回图片数据");

        if (item.url) {
          const url = isVercelRuntime() ? item.url : await persistImage(item.url, prompt);
          return { url, model };
        }

        if (item.b64_json) {
          const url = isVercelRuntime()
            ? `data:image/png;base64,${item.b64_json}`
            : await persistBase64(item.b64_json);
          return { url, model };
        }

        throw new Error("图片格式不支持");
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isRateLimited(err) && attempt < maxAttempts - 1) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  throw lastError ?? new Error("生图失败");
}
