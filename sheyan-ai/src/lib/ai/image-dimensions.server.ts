import fs from "fs/promises";
import path from "path";

export type ImageDimensions = { width: number; height: number };

function parsePngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) return null;
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpegDimensions(buffer: Buffer): ImageDimensions | null {
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buffer[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: buffer.readUInt16BE(i + 5),
        width: buffer.readUInt16BE(i + 7),
      };
    }
    const segmentLen = buffer.readUInt16BE(i + 2);
    i += 2 + segmentLen;
  }
  return null;
}

function parseImageDimensions(buffer: Buffer): ImageDimensions | null {
  return parsePngDimensions(buffer) ?? parseJpegDimensions(buffer);
}

async function loadImageBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) throw new Error("无效的图片数据");
    return Buffer.from(match[1]!, "base64");
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`无法读取图片: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
  return fs.readFile(filePath);
}

export async function readImageDimensions(url: string): Promise<ImageDimensions | null> {
  try {
    const buffer = await loadImageBuffer(url);
    return parseImageDimensions(buffer);
  } catch {
    return null;
  }
}
