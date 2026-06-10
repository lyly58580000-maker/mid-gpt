import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { getSession, requireSession } from "@/lib/auth";
import { isAllowedMime } from "@/lib/attachments";
import { AppError } from "@/lib/billing";
import { jsonError, jsonOk } from "@/lib/api-response";
import { isBetaFeedbackEnabled } from "@/features/beta-feedback/config";
import { isVercelRuntime } from "@/lib/runtime";

const MAX_SIZE = 5 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^\w.\-()\u4e00-\u9fa5]/g, "_").slice(0, 80);
}

export async function POST(req: Request) {
  try {
    if (!isBetaFeedbackEnabled()) {
      throw new AppError("FEATURE_DISABLED", "灰度反馈功能未开启", 404);
    }

    const session = await getSession();
    const user = requireSession(session);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("INVALID_INPUT", "请选择图片", 400);
    }
    if (file.size > MAX_SIZE) {
      throw new AppError("INVALID_INPUT", "图片不能超过 5MB", 400);
    }
    if (!isAllowedMime(file.type, file.name) || !file.type.startsWith("image/")) {
      throw new AppError("INVALID_INPUT", "仅支持图片格式", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let url: string;

    if (isVercelRuntime()) {
      const mime = file.type || "image/png";
      url = `data:${mime};base64,${buffer.toString("base64")}`;
    } else {
      const uploadDir = path.join(process.cwd(), "public", "uploads", user.userId, "beta-feedback");
      await fs.mkdir(uploadDir, { recursive: true });
      const filename = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName(file.name)}`;
      await fs.writeFile(path.join(uploadDir, filename), buffer);
      url = `/uploads/${user.userId}/beta-feedback/${filename}`;
    }

    return jsonOk({
      attachment: {
        id: randomUUID(),
        kind: "image" as const,
        name: file.name,
        url,
        mimeType: file.type || "image/png",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
