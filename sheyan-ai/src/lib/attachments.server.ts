import fs from "fs/promises";
import path from "path";
import {
  canExtractText,
  MAX_EXTRACTED_TEXT,
  type MessageAttachment,
  type ModelContentPart,
} from "@/lib/attachments";

export async function resolveImageForModel(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`无法读取图片: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }

  const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(url).slice(1).toLowerCase() || "png";
  const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export async function extractTextFromBuffer(buffer: Buffer, filename: string, mime: string) {
  if (!canExtractText(filename, mime)) return undefined;
  const text = buffer.toString("utf-8").trim();
  if (!text) return undefined;
  return text.length > MAX_EXTRACTED_TEXT ? `${text.slice(0, MAX_EXTRACTED_TEXT)}\n...(内容已截断)` : text;
}

export async function buildModelContentParts(
  text: string,
  attachments: MessageAttachment[],
): Promise<ModelContentPart[]> {
  const parts: ModelContentPart[] = [];

  if (text.trim()) {
    parts.push({ type: "text", text: text.trim() });
  }

  for (const att of attachments) {
    if (att.kind === "image") {
      try {
        parts.push({ type: "image", image: await resolveImageForModel(att.url) });
      } catch {
        parts.push({
          type: "text",
          text: `[图片 ${att.name} 暂时无法读取，请根据对话上下文作答]`,
        });
      }
      continue;
    }

    if (att.extractedText) {
      parts.push({
        type: "text",
        text: `[文档: ${att.name}]\n${att.extractedText}`,
      });
    } else {
      parts.push({
        type: "text",
        text: `[已上传文档: ${att.name}。该格式暂不支持自动解析，请根据文件名与上下文作答，或请用户粘贴正文。]`,
      });
    }
  }

  if (parts.length === 0) {
    parts.push({ type: "text", text: "请查看附件并回答。" });
  }

  return parts;
}
