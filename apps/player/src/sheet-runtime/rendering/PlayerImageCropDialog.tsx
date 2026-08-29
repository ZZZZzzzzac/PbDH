import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  cropCornerAt,
  cropSelectionFromLayout,
  cropViewportHeight,
  cropViewportWidth,
  initialCropLayout,
  insideCrop,
  moveCrop,
  resizeFreeCrop,
  resizeFixedCrop,
  zoomCrop,
  type CropCorner,
  type CropLayout,
  type PlayerImageCropSelection,
} from "./playerImageCrop";

type DragState =
  | { mode: "move"; pointerX: number; pointerY: number; cropX: number; cropY: number }
  | { mode: "resize"; corner: CropCorner };

interface PlayerImageCropDialogProps {
  file: File;
  label: string;
  working: boolean;
  processingError: string | null;
  onCancel: () => void;
  onConfirm: (selection: PlayerImageCropSelection) => void;
}

type AspectRatioChoice = "free" | "original" | "square" | "card";

export function PlayerImageCropDialog({ file, label, working, processingError, onCancel, onConfirm }: PlayerImageCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const layoutRef = useRef<CropLayout | null>(null);
  const [layout, setLayout] = useState<CropLayout | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aspectRatioChoice, setAspectRatioChoice] = useState<AspectRatioChoice>("free");

  const selectedAspectRatio = resolveAspectRatio(aspectRatioChoice, imageRef.current);

  useEffect(() => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    let cancelled = false;
    setLayout(null);
    setLoadError(null);
    image.onload = () => {
      if (cancelled) return;
      imageRef.current = image;
      try {
        setLayout(initialCropLayout(image.naturalWidth, image.naturalHeight));
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "图片尺寸无效。");
      }
    };
    image.onerror = () => { if (!cancelled) setLoadError("图片已损坏或无法读取。"); };
    image.src = url;
    return () => {
      cancelled = true;
      imageRef.current = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (canvas && image && layout) drawCropper(canvas, image, layout);
  }, [layout]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (event: globalThis.WheelEvent) => {
      const currentLayout = layoutRef.current;
      if (!currentLayout) return;
      event.preventDefault();
      event.stopPropagation();
      const bounds = canvas.getBoundingClientRect();
      const cursor = {
        x: (event.clientX - bounds.left) * cropViewportWidth / Math.max(1, bounds.width),
        y: (event.clientY - bounds.top) * cropViewportHeight / Math.max(1, bounds.height),
      };
      setLayout(zoomCrop(currentLayout, cursor.x, cursor.y, event.deltaY));
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || working) return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, working]);

  const point = (clientX: number, clientY: number) => {
    const bounds = canvasRef.current!.getBoundingClientRect();
    return {
      x: (clientX - bounds.left) * cropViewportWidth / Math.max(1, bounds.width),
      y: (clientY - bounds.top) * cropViewportHeight / Math.max(1, bounds.height),
    };
  };

  const startDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!layout || event.button !== 0) return;
    const cursor = point(event.clientX, event.clientY);
    const corner = cropCornerAt(cursor.x, cursor.y, layout);
    if (corner) dragRef.current = { mode: "resize", corner };
    else if (insideCrop(cursor.x, cursor.y, layout)) {
      dragRef.current = { mode: "move", pointerX: cursor.x, pointerY: cursor.y, cropX: layout.cropX, cropY: layout.cropY };
    } else return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const drag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!layout || !dragRef.current) return;
    const cursor = point(event.clientX, event.clientY);
    const origin = dragRef.current;
    setLayout(origin.mode === "resize"
      ? selectedAspectRatio
        ? resizeFixedCrop(layout, origin.corner, cursor.x, cursor.y, selectedAspectRatio)
        : resizeFreeCrop(layout, origin.corner, cursor.x, cursor.y)
      : moveCrop(layout, origin.cropX + cursor.x - origin.pointerX, origin.cropY + cursor.y - origin.pointerY));
  };

  return createPortal(
    <div className="player-image-crop-backdrop" data-output-exclude="true">
      <section className="player-image-crop-dialog" role="dialog" aria-modal="true" aria-label={`裁剪${label}`}>
        <header className="player-image-crop-header">
          <div className="player-image-crop-heading">
            <div><p>Player Image</p><h2>裁剪{label}</h2></div>
            <span>拖动位置或四角 · 滚轮缩放</span>
          </div>
          <div className="player-image-crop-actions">
            <label>
              <span className="visually-hidden">裁剪比例</span>
              <select
                aria-label="裁剪比例"
                value={aspectRatioChoice}
                disabled={!layout || working}
                onChange={(event) => {
                  const choice = event.target.value as AspectRatioChoice;
                  setAspectRatioChoice(choice);
                  const image = imageRef.current;
                  if (image) setLayout(initialCropLayout(image.naturalWidth, image.naturalHeight, resolveAspectRatio(choice, image)));
                }}
              >
                <option value="free">不限制比例</option>
                <option value="original">原图比例</option>
                <option value="square">1:1</option>
                <option value="card">63:88</option>
              </select>
            </label>
            <button className="icon-button secondary-button" type="button" onClick={onCancel} disabled={working}>取消</button>
            <button className="icon-button" type="button" onClick={() => layout && onConfirm(cropSelectionFromLayout(layout))} disabled={!layout || working || Boolean(loadError)}>
              {working ? "正在处理…" : "应用裁剪"}
            </button>
          </div>
        </header>
        <div className="player-image-crop-workspace">
          <canvas
            ref={canvasRef}
            width={cropViewportWidth}
            height={cropViewportHeight}
            onPointerDown={startDrag}
            onPointerMove={drag}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
            aria-label="拖拽裁剪区域和四角，滚轮缩放"
          />
          {!layout && !loadError ? <div className="player-image-crop-status">正在读取图片…</div> : null}
          {loadError ? <div className="player-image-crop-status is-error" role="alert">{loadError}</div> : null}
        </div>
        {processingError ? <p className="player-image-crop-error" role="alert">{processingError}</p> : null}
      </section>
    </div>,
    document.body,
  );
}

function resolveAspectRatio(choice: AspectRatioChoice, image: HTMLImageElement | null): number | undefined {
  if (choice === "original") return image ? image.naturalWidth / image.naturalHeight : undefined;
  if (choice === "square") return 1;
  if (choice === "card") return 63 / 88;
  return undefined;
}

function drawCropper(canvas: HTMLCanvasElement, image: HTMLImageElement, layout: CropLayout) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#182022";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, layout.imageX, layout.imageY, layout.imageWidth, layout.imageHeight);
  context.fillStyle = "rgb(0 0 0 / 58%)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.beginPath();
  context.rect(layout.cropX, layout.cropY, layout.cropWidth, layout.cropHeight);
  context.clip();
  context.drawImage(image, layout.imageX, layout.imageY, layout.imageWidth, layout.imageHeight);
  context.restore();
  context.strokeStyle = "#67e8f9";
  context.lineWidth = 3;
  context.strokeRect(layout.cropX, layout.cropY, layout.cropWidth, layout.cropHeight);
  context.strokeStyle = "rgb(255 255 255 / 42%)";
  context.lineWidth = 1;
  context.beginPath();
  for (const fraction of [1 / 3, 2 / 3]) {
    context.moveTo(layout.cropX + layout.cropWidth * fraction, layout.cropY);
    context.lineTo(layout.cropX + layout.cropWidth * fraction, layout.cropY + layout.cropHeight);
    context.moveTo(layout.cropX, layout.cropY + layout.cropHeight * fraction);
    context.lineTo(layout.cropX + layout.cropWidth, layout.cropY + layout.cropHeight * fraction);
  }
  context.stroke();
  context.fillStyle = "#67e8f9";
  for (const [x, y] of cropCorners(layout)) context.fillRect(x - 8, y - 8, 16, 16);
}

function cropCorners(layout: CropLayout): Array<[number, number]> {
  return [
    [layout.cropX, layout.cropY],
    [layout.cropX + layout.cropWidth, layout.cropY],
    [layout.cropX, layout.cropY + layout.cropHeight],
    [layout.cropX + layout.cropWidth, layout.cropY + layout.cropHeight],
  ];
}
