import fs from "fs/promises";
import path from "path";
import OpenAI, { toFile } from "openai";
import { resolveImageForModel } from "@/lib/attachments.server";
import { readImageDimensions } from "@/lib/ai/image-dimensions.server";
import { logImage } from "@/lib/ai/image-logger";
import { buildMaskedEditPrompt } from "@/lib/ai/mask-edit-prompt";
import {
  detectAspectChangeRequest,
  dimensionsToApiSize,
  type ApiImageSize,
} from "@/lib/ai/image-size";
import { isVercelRuntime } from "@/lib/runtime";

export type GenerateImageInput = {
  prompt: string;
  referenceImageUrls?: string[];
  maskDataUrl?: string;
  abortSignal?: AbortSignal;
  size?: ApiImageSize;
};

function getImageTimeoutMs() {
  const raw = Number(process.env.IMAGE_API_TIMEOUT_MS ?? 240_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 240_000;
}

function getImageClient() {
  return new OpenAI({
    apiKey: process.env.IMAGE_API_KEY,
    baseURL: process.env.IMAGE_API_BASE_URL,
    timeout: getImageTimeoutMs(),
  });
}

function mapImageError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /timeout|timed out|aborted|AbortError|ETIMEDOUT|ECONNRESET/i.test(msg) ||
    (err instanceof Error && err.name === "AbortError")
  ) {
    const sec = Math.round(getImageTimeoutMs() / 1000);
    return new Error(
      `生图超时（已等待约 ${sec} 秒）。QuickRouter 图生图上游响应过慢，请点停止后稍后重试，或先去掉参考图用纯文生图`,
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

async function persistImage(sourceUrl: string): Promise<string> {
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

async function dataUrlToUploadable(dataUrl: string, index: number) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("无效的图片数据");
  const mime = match[1]!;
  const buffer = Buffer.from(match[2]!, "base64");
  const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  return toFile(buffer, `reference-${index}.${ext}`, { type: mime });
}

async function urlToUploadable(url: string, index: number) {
  const dataUrl = url.startsWith("data:") ? url : await resolveImageForModel(url);
  return dataUrlToUploadable(dataUrl, index);
}

function resolveImageSize(): ApiImageSize {
  const raw = process.env.IMAGE_SIZE ?? "auto";
  if (raw === "1024x1536" || raw === "1536x1024" || raw === "auto") return raw;
  return "1024x1024";
}

async function resolveEditSize(
  referenceImageUrls: string[],
  prompt: string,
): Promise<ApiImageSize> {
  if (detectAspectChangeRequest(prompt)) return resolveImageSize();
  const dims = referenceImageUrls[0] ? await readImageDimensions(referenceImageUrls[0]) : null;
  if (dims) {
    const size = dimensionsToApiSize(dims.width, dims.height);
    logImage("size_from_reference", { width: dims.width, height: dims.height, size });
    return size;
  }
  return "auto";
}

async function saveImageItem(item: { url?: string | null; b64_json?: string | null }) {
  if (item.url) {
    return isVercelRuntime() ? item.url : await persistImage(item.url);
  }
  if (item.b64_json) {
    return isVercelRuntime()
      ? `data:image/png;base64,${item.b64_json}`
      : await persistBase64(item.b64_json);
  }
  throw new Error("图片格式不支持");
}

export async function generateImage(
  input: GenerateImageInput | string,
): Promise<{ url: string; model: string }> {
  const { prompt, referenceImageUrls = [], maskDataUrl, abortSignal, size: sizeOverride } =
    typeof input === "string"
      ? {
          prompt: input,
          referenceImageUrls: [] as string[],
          maskDataUrl: undefined,
          abortSignal: undefined,
          size: undefined,
        }
      : input;

  const client = getImageClient();
  const requestOptions = { signal: abortSignal };
  const primaryModel = process.env.IMAGE_MODEL_NAME ?? "gpt-image-2";
  const fallbackModel = process.env.IMAGE_FALLBACK_MODEL?.trim();
  const models = [...new Set([primaryModel, fallbackModel].filter((m): m is string => Boolean(m)))];
  const useEdit = referenceImageUrls.length > 0;
  const hasMask = Boolean(maskDataUrl);
  const effectivePrompt = hasMask ? buildMaskedEditPrompt(prompt) : prompt;
  const size =
    sizeOverride ??
    (useEdit ? await resolveEditSize(referenceImageUrls, prompt) : resolveImageSize());
  const maxAttempts = 3;
  const started = Date.now();

  logImage("request", {
    mode: useEdit ? "edit" : "generate",
    refs: referenceImageUrls.length,
    hasMask,
    size,
    model: primaryModel,
    promptLen: effectivePrompt.length,
  });

  let lastError: Error | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (useEdit) {
          logImage("prepare_refs", { model, attempt: attempt + 1 });
          const images = await Promise.all(
            referenceImageUrls.map((url, index) => urlToUploadable(url, index)),
          );
          const maskFile = maskDataUrl ? await dataUrlToUploadable(maskDataUrl, 99) : undefined;
          logImage("api_edit_call", {
            model,
            attempt: attempt + 1,
            elapsedMs: Date.now() - started,
            hasMask: Boolean(maskFile),
            size,
          });
          const response = await client.images.edit(
            {
              model,
              image: images.length === 1 ? images[0]! : images,
              prompt: effectivePrompt,
              size,
              n: 1,
              ...(maskFile ? { mask: maskFile } : {}),
            },
            requestOptions,
          );
          const item = response.data?.[0];
          if (!item) throw new Error("未返回图片数据");
          const url = await saveImageItem(item);
          logImage("success", { model, mode: "edit", elapsedMs: Date.now() - started });
          return { url, model };
        }

        logImage("api_generate_call", { model, attempt: attempt + 1, elapsedMs: Date.now() - started });
        const response = await client.images.generate(
          {
            model,
            prompt: effectivePrompt,
            size: size === "auto" ? "1024x1024" : size,
            n: 1,
          },
            requestOptions,
        );

        const item = response.data?.[0];
        if (!item) throw new Error("未返回图片数据");
        const url = await saveImageItem(item);
        logImage("success", { model, mode: "generate", elapsedMs: Date.now() - started });
        return { url, model };
      } catch (err) {
        lastError = mapImageError(err);
        logImage("attempt_failed", {
          model,
          attempt: attempt + 1,
          elapsedMs: Date.now() - started,
          error: lastError.message.slice(0, 200),
        });
        if (isRateLimited(err) && attempt < maxAttempts - 1) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  logImage("failed", { elapsedMs: Date.now() - started, error: lastError?.message?.slice(0, 200) });
  throw lastError ?? new Error("生图失败");
}
