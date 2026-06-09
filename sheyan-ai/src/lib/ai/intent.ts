const IMAGE_PATTERNS = [
  /生成一张/,
  /画一张/,
  /给我画/,
  /帮我画/,
  /画个/,
  /画图/,
  /出一张图/,
  /帮我生图/,
  /做一张海报/,
  /生成头像/,
  /生成插画/,
  /生成效果图/,
  /画面是/,
  /图片风格是/,
];

const TEXT_OVERRIDE = [
  /写一个生图提示词/,
  /优化.*提示词/,
  /分析这张图应该怎么生成/,
  /适合生图的描述/,
  /改成提示词/,
];

export function detectIntent(input: string): "text" | "image" {
  if (TEXT_OVERRIDE.some((p) => p.test(input))) return "text";
  if (IMAGE_PATTERNS.some((p) => p.test(input))) return "image";
  return "text";
}
