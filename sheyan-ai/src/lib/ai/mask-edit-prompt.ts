/** 带蒙版的局部编辑：强化约束，减少蒙版外被误改 */
export function buildMaskedEditPrompt(userPrompt: string): string {
  const task = userPrompt.trim();
  return [
    "STRICT INPAINTING / REGION-LOCKED EDIT.",
    "Edit ONLY the masked region (fully transparent pixels in the mask image).",
    "The mask marks the ONLY area you may change.",
    "Do NOT modify, remove, erase, repaint, or alter ANY person, object, pixel, or background OUTSIDE the masked region.",
    "All unmasked people must remain exactly as in the original — same count, pose, position, and appearance.",
    "蒙版约束：只能修改蒙版透明区域；蒙版外一切人物、背景、构图、光线必须 100% 保持原样，不得删除或改动蒙版外的任何人。",
    `蒙版内任务：${task}`,
  ].join("\n");
}
