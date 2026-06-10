"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, RotateCcw, Send, X, ZoomIn } from "lucide-react";

type ImageEditorModalProps = {
  imageUrl: string;
  onClose: () => void;
  onSubmit: (payload: {
    prompt: string;
    maskDataUrl: string | null;
    previewDataUrl: string | null;
  }) => void;
  submitting?: boolean;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;

function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export function ImageEditorModal({
  imageUrl,
  onClose,
  onSubmit,
  submitting = false,
}: ImageEditorModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [prompt, setPrompt] = useState("");
  const [brushSize, setBrushSize] = useState(28);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [baseDisplaySize, setBaseDisplaySize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const drawingRef = useRef(false);
  const panningRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastPanClientRef = useRef({ x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const syncCanvasLayout = useCallback(() => {
    const img = imageRef.current;
    const canvas = drawCanvasRef.current;
    const container = containerRef.current;
    if (!img || !canvas || !container || !img.naturalWidth) return;

    const maxW = container.clientWidth;
    const maxH = container.clientHeight;
    const ratio = img.naturalWidth / img.naturalHeight;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setBaseDisplaySize({ width: w, height: h });
  }, []);

  const resetView = useCallback(() => {
    setView({ zoom: 1, panX: 0, panY: 0 });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        resetView();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", syncCanvasLayout);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", syncCanvasLayout);
    };
  }, [onClose, resetView, syncCanvasLayout]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const px = e.clientX - cx;
      const py = e.clientY - cy;

      const { zoom, panX, panY } = viewRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = clampZoom(zoom * factor);
      const newPanX = px - ((px - panX) / zoom) * newZoom;
      const newPanY = py - ((py - panY) / zoom) * newZoom;

      setView({ zoom: newZoom, panX: newPanX, panY: newPanY });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const drawDot = (x: number, y: number) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "rgba(139, 92, 246, 0.75)";
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    hasStrokeRef.current = true;
  };

  const drawLine = (x0: number, y0: number, x1: number, y1: number) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "rgba(139, 92, 246, 0.75)";
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    hasStrokeRef.current = true;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (submitting) return;

    if (e.button === 1) {
      e.preventDefault();
      panningRef.current = true;
      setIsPanning(true);
      lastPanClientRef.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return;

    drawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = getCanvasPoint(e);
    lastPointRef.current = p;
    drawDot(p.x, p.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panningRef.current) {
      const dx = e.clientX - lastPanClientRef.current.x;
      const dy = e.clientY - lastPanClientRef.current.y;
      lastPanClientRef.current = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, panX: v.panX + dx, panY: v.panY + dy }));
      return;
    }

    if (!drawingRef.current || submitting) return;
    const p = getCanvasPoint(e);
    const last = lastPointRef.current;
    if (last) drawLine(last.x, last.y, p.x, p.y);
    lastPointRef.current = p;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panningRef.current) {
      panningRef.current = false;
      setIsPanning(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }

    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const clearMask = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokeRef.current = false;
  };

  const expandKeepGuardBand = (maskData: ImageData, radius: number) => {
    const { width: w, height: h, data } = maskData;
    const toKeep = new Set<number>();

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] !== 255) continue;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > radius * radius) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            toKeep.add((ny * w + nx) * 4);
          }
        }
      }
    }

    for (const idx of toKeep) {
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  };

  const buildPreviewDataUrl = (): string | null => {
    const img = imageRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!img?.naturalWidth || !drawCanvas) return null;

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    if (hasStrokeRef.current) {
      ctx.drawImage(drawCanvas, 0, 0);
    }
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const buildMaskDataUrl = (): string | null => {
    if (!hasStrokeRef.current || naturalSize.width === 0) return null;
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return null;

    const w = naturalSize.width;
    const h = naturalSize.height;
    const drawCtx = drawCanvas.getContext("2d", { willReadFrequently: true });
    if (!drawCtx) return null;

    const drawData = drawCtx.getImageData(0, 0, w, h);
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return null;

    const maskData = maskCtx.createImageData(w, h);
    const threshold = 24;

    for (let i = 0; i < drawData.data.length; i += 4) {
      const painted = drawData.data[i + 3]! > threshold;
      if (painted) {
        maskData.data[i] = 0;
        maskData.data[i + 1] = 0;
        maskData.data[i + 2] = 0;
        maskData.data[i + 3] = 0;
      } else {
        maskData.data[i] = 255;
        maskData.data[i + 1] = 255;
        maskData.data[i + 2] = 255;
        maskData.data[i + 3] = 255;
      }
    }

    expandKeepGuardBand(maskData, 5);
    maskCtx.putImageData(maskData, 0, 0);
    return maskCanvas.toDataURL("image/png");
  };

  const handleSubmit = () => {
    const text = prompt.trim();
    if (!text || submitting) return;
    const maskDataUrl = buildMaskDataUrl();
    onSubmit({
      prompt: text,
      maskDataUrl,
      previewDataUrl: maskDataUrl ? buildPreviewDataUrl() : null,
    });
  };

  const zoomPercent = Math.round(view.zoom * 100);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 text-white border-b border-white/10">
        <div className="flex items-center gap-2 text-sm">
          <ZoomIn size={16} />
          <span>图片编辑 — 在要修改的区域涂抹，下方输入修改说明</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10"
          aria-label="关闭"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex items-center gap-3 px-4 py-2 text-white/80 text-sm border-b border-white/10 flex-wrap">
        <label className="flex items-center gap-2">
          笔刷
          <input
            type="range"
            min={8}
            max={80}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-28"
          />
        </label>
        <button
          type="button"
          onClick={clearMask}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15"
        >
          <Eraser size={14} />
          清除涂抹
        </button>
        <button
          type="button"
          onClick={resetView}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15"
          title="Ctrl+0 重置"
        >
          <RotateCcw size={14} />
          重置视图
        </button>
        <span className="text-white/60 text-xs tabular-nums">{zoomPercent}%</span>
        <span className="text-white/50 text-xs hidden sm:inline">
          滚轮缩放 · 中键拖动 · 左键涂抹蒙版
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden p-4"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="relative will-change-transform"
          style={{
            width: baseDisplaySize.width || undefined,
            height: baseDisplaySize.height || undefined,
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
            transformOrigin: "center center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={imageUrl}
            alt="编辑中"
            className="block select-none pointer-events-none"
            style={{
              width: baseDisplaySize.width || undefined,
              height: baseDisplaySize.height || undefined,
            }}
            draggable={false}
            onLoad={syncCanvasLayout}
          />
          <canvas
            ref={drawCanvasRef}
            className={`absolute inset-0 touch-none select-none ${
              isPanning ? "cursor-grabbing" : "cursor-crosshair"
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#111] p-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述要如何修改，例如：把球场灯光改成暖黄色、去掉背景里的人…"
            rows={2}
            className="flex-1 resize-none rounded-xl bg-white/10 text-white placeholder:text-white/40 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!prompt.trim() || submitting}
            className="self-end flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-indigo-500"
          >
            <Send size={16} />
            {submitting ? "生图中…" : "应用修改"}
          </button>
        </div>
      </div>
    </div>
  );
}
