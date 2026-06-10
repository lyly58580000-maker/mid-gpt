/** 上传前压缩图片，减少体积与等待时间 */
export async function compressImageForUpload(
  file: File,
  opts?: { maxSide?: number; quality?: number; skipBelowBytes?: number },
): Promise<File> {
  const maxSide = opts?.maxSide ?? 2048;
  const quality = opts?.quality ?? 0.88;
  const skipBelowBytes = opts?.skipBelowBytes ?? 350_000;

  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }
  if (file.size <= skipBelowBytes && (file.type === "image/jpeg" || file.type === "image/webp")) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > maxSide ? maxSide / longest : 1;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
  if (!blob || blob.size >= file.size) {
    return file;
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
