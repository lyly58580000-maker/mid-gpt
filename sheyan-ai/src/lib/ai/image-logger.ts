export function logImage(stage: string, meta?: Record<string, unknown>) {
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[sheyan:image] ${stage}${suffix}`);
}
