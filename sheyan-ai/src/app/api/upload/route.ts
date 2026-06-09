import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import {
  getAttachmentKind,
  isAllowedMime,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS,
} from "@/lib/attachments";
import { extractTextFromBuffer } from "@/lib/attachments.server";
import { AppError } from "@/lib/billing";
import { jsonError, jsonOk } from "@/lib/api-response";

function safeName(name: string) {
  return name.replace(/[^\w.\-()\u4e00-\u9fa5]/g, "_").slice(0, 80);
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      throw new AppError("INVALID_INPUT", "请选择要上传的文件", 400);
    }
    if (files.length > MAX_ATTACHMENTS) {
      throw new AppError("INVALID_INPUT", `最多上传 ${MAX_ATTACHMENTS} 个文件`, 400);
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", session.userId);
    await fs.mkdir(uploadDir, { recursive: true });

    const attachments = [];

    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        throw new AppError("INVALID_INPUT", `文件 ${file.name} 超过 5MB 限制`, 400);
      }
      if (!isAllowedMime(file.type, file.name)) {
        throw new AppError(
          "INVALID_INPUT",
          `不支持的文件类型: ${file.name}（支持图片与常见文档）`,
          400,
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const kind = getAttachmentKind(file.type);
      const filename = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName(file.name)}`;
      const filepath = path.join(uploadDir, filename);
      await fs.writeFile(filepath, buffer);

      const extractedText =
        kind === "document" ? await extractTextFromBuffer(buffer, file.name, file.type) : undefined;

      attachments.push({
        id: randomUUID(),
        kind,
        name: file.name,
        url: `/uploads/${session.userId}/${filename}`,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        ...(extractedText ? { extractedText } : {}),
      });
    }

    return jsonOk({ attachments });
  } catch (error) {
    return jsonError(error);
  }
}
