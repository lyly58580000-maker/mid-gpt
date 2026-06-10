export type ApiImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";

/** 用户明确要求改变画幅 / 比例 */
export function detectAspectChangeRequest(message: string): boolean {
  return /横版|竖版|方形|画幅|比例|尺寸|分辨率|16:9|9:16|1:1|4:3|3:4|2:3|3:2|变宽|变窄|裁剪|放大|缩小|高清|4k|8k/i.test(
    message,
  );
}

export function dimensionsToApiSize(width: number, height: number): ApiImageSize {
  if (width <= 0 || height <= 0) return "auto";
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.12) return "1024x1024";
  if (ratio > 1.12) return "1536x1024";
  if (ratio < 0.88) return "1024x1536";
  return "1024x1024";
}
