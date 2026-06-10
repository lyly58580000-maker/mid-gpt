import { parseAttachments, type MessageAttachment } from "@/lib/attachments";

export type HistoryImageMessage = {
  role: "user" | "assistant";
  contentType?: "text" | "image";
  imageUrl?: string | null;
  attachments?: string | null;
};

export type ImageRequest = {
  shouldGenerate: boolean;
  prompt: string;
  referenceImageUrls: string[];
  maskDataUrl?: string;
};

/** 明确要求只要文字，不要真的生图 */
const TEXT_OVERRIDE = [
  /写一个生图提示词/,
  /优化.*提示词/,
  /分析这张图应该怎么生成/,
  /适合生图的描述/,
  /改成提示词/,
  /不要生成图/,
  /别生图/,
  /不用生图/,
];

/** 文生图 / 图生图 / 改图 */
const IMAGE_ACTION = [
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
  /转换/,
  /改成/,
  /变为/,
  /变成/,
  /风格化/,
  /重绘/,
  /效果图/,
  /海报/,
  /插画/,
  /头像/,
  /生成.*图/,
  /做.*图/,
  /render/i,
  /style/i,
  /图生图/,
  /以图生图/,
  /参考图/,
  /这张.*图/,
  /把这.*图/,
  /将.*图/,
  /用我的图/,
  /保持.*构图/,
  /吉卜力/,
  /宫崎骏/,
  /动漫风/,
  /卡通风/,
  /水彩风/,
  /油画风/,
  /赛博朋克/,
  /像素风/,
  /写实风/,
  /风格$/,
  /风格化$/,
  /来一张/,
  /再来一张/,
  /出图/,
  /做一张/,
  /设计一张/,
  /设计个/,
  /帮我做.*视觉/,
  /想看.*图/,
  /文生图/,
  /修改/,
  /去掉/,
  /删掉/,
  /换成/,
  /改为/,
  /加上/,
  /增加/,
];

const REFERENCES_PREVIOUS_IMAGE = /这张图|这张照片|这个照片|上面的图|刚才的图|生成的图|这幅图|此图|上一张/;

function wantsImageAction(message: string) {
  return IMAGE_ACTION.some((p) => p.test(message));
}

function wantsTextOnly(message: string) {
  return TEXT_OVERRIDE.some((p) => p.test(message));
}

function imageUrlsFromAttachments(attachments: MessageAttachment[]) {
  return attachments.filter((a) => a.kind === "image").map((a) => a.url);
}

function findHistoryReferenceImage(history: HistoryImageMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role === "assistant" && m.contentType === "image" && m.imageUrl) {
      return m.imageUrl;
    }
    const imgs = parseAttachments(m.attachments).filter((a) => a.kind === "image");
    if (imgs.length > 0) return imgs[0]!.url;
  }
  return null;
}

export function resolveImageRequest(input: {
  message: string;
  attachments?: MessageAttachment[];
  history?: HistoryImageMessage[];
}): ImageRequest {
  const message = input.message.trim();
  const attachments = input.attachments ?? [];
  const history = input.history ?? [];
  const uploadedImages = imageUrlsFromAttachments(attachments);

  if (wantsTextOnly(message)) {
    return { shouldGenerate: false, prompt: message, referenceImageUrls: [] };
  }

  const imageAction = wantsImageAction(message);

  if (uploadedImages.length > 0) {
    if (imageAction && !wantsTextOnly(message)) {
      return {
        shouldGenerate: true,
        prompt: message,
        referenceImageUrls: uploadedImages,
      };
    }
    return { shouldGenerate: false, prompt: message, referenceImageUrls: [] };
  }

  const historyRef =
    REFERENCES_PREVIOUS_IMAGE.test(message) ? findHistoryReferenceImage(history) : null;

  if (imageAction) {
    return {
      shouldGenerate: true,
      prompt: message,
      referenceImageUrls: historyRef ? [historyRef] : [],
    };
  }

  return { shouldGenerate: false, prompt: message, referenceImageUrls: [] };
}
