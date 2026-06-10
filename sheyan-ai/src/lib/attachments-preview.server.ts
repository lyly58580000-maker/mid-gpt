import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import type { MessageAttachment } from "@/lib/attachments";
import { isVercelRuntime } from "@/lib/runtime";

export async function persistDataUrlImage(
  dataUrl: string,
  userId: string,
  prefix = "preview",
): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("无效的图片数据");

  const mime = match[1]!;
  const buffer = Buffer.from(match[2]!, "base64");
  const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";

  if (isVercelRuntime()) {
    return dataUrl;
  }

  const dir = path.join(process.cwd(), "public", "uploads", userId);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return `/uploads/${userId}/${filename}`;
}

export async function maskPreviewAttachment(
  dataUrl: string,
  userId: string,
): Promise<MessageAttachment> {
  const url = await persistDataUrlImage(dataUrl, userId, "mask-preview");
  return {
    id: randomUUID(),
    kind: "image",
    name: "蒙版预览",
    url,
    mimeType: dataUrl.includes("image/jpeg") ? "image/jpeg" : "image/png",
    size: 0,
  };
}
