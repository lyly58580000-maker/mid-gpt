export type MessageAttachment = {
  id: string;
  kind: "image" | "document";
  name: string;
  url: string;
  mimeType: string;
  size: number;
  extractedText?: string;
};

export type ModelContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string };

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "json", "csv", "log", "html", "htm", "xml",
  "js", "ts", "tsx", "jsx", "py", "java", "yaml", "yml", "sql", "css", "sh",
]);

const IMAGE_MIMES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp",
]);

const DOC_MIMES = new Set([
  "text/plain", "text/markdown", "text/csv", "text/html", "application/json",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;
export const MAX_EXTRACTED_TEXT = 12000;

export function isAllowedMime(mime: string, filename: string) {
  if (IMAGE_MIMES.has(mime)) return true;
  if (DOC_MIMES.has(mime)) return true;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(ext);
}

export function getAttachmentKind(mime: string): "image" | "document" {
  return mime.startsWith("image/") || IMAGE_MIMES.has(mime) ? "image" : "document";
}

export function canExtractText(filename: string, mime: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return mime.startsWith("text/") || TEXT_EXTENSIONS.has(ext) || mime === "application/json";
}

export function parseAttachments(raw: string | null | undefined): MessageAttachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as MessageAttachment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeAttachments(attachments: MessageAttachment[]) {
  return attachments.length > 0 ? JSON.stringify(attachments) : null;
}
