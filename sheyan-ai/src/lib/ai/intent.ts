import { resolveImageRequest } from "@/lib/ai/image-intent";

/** @deprecated 请使用 resolveImageRequest */
export function detectIntent(input: string): "text" | "image" {
  return resolveImageRequest({ message: input }).shouldGenerate ? "image" : "text";
}
