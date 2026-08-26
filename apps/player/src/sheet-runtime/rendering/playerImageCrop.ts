export const cropViewportWidth = 720;
export const cropViewportHeight = 540;

export interface PlayerImageCropSelection {
  sourceWidth: number;
  sourceHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropLayout {
  sourceWidth: number;
  sourceHeight: number;
  imageScale: number;
  imageX: number;
  imageY: number;
  imageWidth: number;
  imageHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
}

export type CropCorner = "nw" | "ne" | "sw" | "se";

const minimumCropSize = 48;

export function initialCropLayout(sourceWidth: number, sourceHeight: number, aspectRatio?: number): CropLayout {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("图片尺寸无效。");
  }
  const imageScale = Math.min(cropViewportWidth / sourceWidth, cropViewportHeight / sourceHeight);
  const imageWidth = sourceWidth * imageScale;
  const imageHeight = sourceHeight * imageScale;
  const imageX = (cropViewportWidth - imageWidth) / 2;
  const imageY = (cropViewportHeight - imageHeight) / 2;
  const cropWidth = aspectRatio
    ? Math.min(imageWidth * 0.9, imageHeight * 0.9 * aspectRatio)
    : imageWidth * 0.9;
  const cropHeight = aspectRatio ? cropWidth / aspectRatio : imageHeight * 0.9;
  return {
    sourceWidth,
    sourceHeight,
    imageScale,
    imageX,
    imageY,
    imageWidth,
    imageHeight,
    cropX: imageX + (imageWidth - cropWidth) / 2,
    cropY: imageY + (imageHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
  };
}

export function resizeFixedCrop(
  layout: CropLayout,
  corner: CropCorner,
  x: number,
  y: number,
  aspectRatio: number,
): CropLayout {
  const anchorX = corner.endsWith("w") ? layout.cropX + layout.cropWidth : layout.cropX;
  const anchorY = corner.startsWith("n") ? layout.cropY + layout.cropHeight : layout.cropY;
  const horizontalDirection = corner.endsWith("w") ? -1 : 1;
  const verticalDirection = corner.startsWith("n") ? -1 : 1;
  const horizontalLimit = horizontalDirection < 0
    ? anchorX - layout.imageX
    : layout.imageX + layout.imageWidth - anchorX;
  const verticalLimit = verticalDirection < 0
    ? anchorY - layout.imageY
    : layout.imageY + layout.imageHeight - anchorY;
  const maximumWidth = Math.min(horizontalLimit, verticalLimit * aspectRatio);
  const minimumWidth = Math.min(minimumCropSize, maximumWidth);
  const pointerWidth = Math.max(
    Math.abs(x - anchorX),
    Math.abs(y - anchorY) * aspectRatio,
  );
  const width = clamp(pointerWidth, minimumWidth, maximumWidth);
  const height = width / aspectRatio;
  return {
    ...layout,
    cropX: horizontalDirection < 0 ? anchorX - width : anchorX,
    cropY: verticalDirection < 0 ? anchorY - height : anchorY,
    cropWidth: width,
    cropHeight: height,
  };
}

export function moveCrop(layout: CropLayout, cropX: number, cropY: number): CropLayout {
  return {
    ...layout,
    cropX: clamp(cropX, layout.imageX, layout.imageX + layout.imageWidth - layout.cropWidth),
    cropY: clamp(cropY, layout.imageY, layout.imageY + layout.imageHeight - layout.cropHeight),
  };
}

export function resizeFreeCrop(layout: CropLayout, corner: CropCorner, x: number, y: number): CropLayout {
  const minimum = Math.min(minimumCropSize, layout.imageWidth, layout.imageHeight);
  const right = layout.cropX + layout.cropWidth;
  const bottom = layout.cropY + layout.cropHeight;
  if (corner === "nw") {
    const left = clamp(x, layout.imageX, right - minimum);
    const top = clamp(y, layout.imageY, bottom - minimum);
    return { ...layout, cropX: left, cropY: top, cropWidth: right - left, cropHeight: bottom - top };
  }
  if (corner === "ne") {
    const nextRight = clamp(x, layout.cropX + minimum, layout.imageX + layout.imageWidth);
    const top = clamp(y, layout.imageY, bottom - minimum);
    return { ...layout, cropY: top, cropWidth: nextRight - layout.cropX, cropHeight: bottom - top };
  }
  if (corner === "sw") {
    const left = clamp(x, layout.imageX, right - minimum);
    const nextBottom = clamp(y, layout.cropY + minimum, layout.imageY + layout.imageHeight);
    return { ...layout, cropX: left, cropWidth: right - left, cropHeight: nextBottom - layout.cropY };
  }
  const nextRight = clamp(x, layout.cropX + minimum, layout.imageX + layout.imageWidth);
  const nextBottom = clamp(y, layout.cropY + minimum, layout.imageY + layout.imageHeight);
  return { ...layout, cropWidth: nextRight - layout.cropX, cropHeight: nextBottom - layout.cropY };
}

export function zoomCrop(layout: CropLayout, pointerX: number, pointerY: number, deltaY: number): CropLayout {
  const ratio = layout.cropWidth / layout.cropHeight;
  const maximumHeight = Math.min(layout.imageHeight, layout.imageWidth / ratio);
  const minimumHeight = Math.min(minimumCropSize, maximumHeight);
  const nextHeight = clamp(layout.cropHeight * Math.exp(deltaY * 0.0008), minimumHeight, maximumHeight);
  const nextWidth = nextHeight * ratio;
  const scale = nextWidth / layout.cropWidth;
  return {
    ...layout,
    cropWidth: nextWidth,
    cropHeight: nextHeight,
    cropX: clamp(pointerX - (pointerX - layout.cropX) * scale, layout.imageX, layout.imageX + layout.imageWidth - nextWidth),
    cropY: clamp(pointerY - (pointerY - layout.cropY) * scale, layout.imageY, layout.imageY + layout.imageHeight - nextHeight),
  };
}

export function cropSelectionFromLayout(layout: CropLayout): PlayerImageCropSelection {
  return {
    sourceWidth: layout.sourceWidth,
    sourceHeight: layout.sourceHeight,
    x: (layout.cropX - layout.imageX) / layout.imageScale,
    y: (layout.cropY - layout.imageY) / layout.imageScale,
    width: layout.cropWidth / layout.imageScale,
    height: layout.cropHeight / layout.imageScale,
  };
}

export function cropCornerAt(x: number, y: number, layout: CropLayout): CropCorner | null {
  const corners: Array<[CropCorner, number, number]> = [
    ["nw", layout.cropX, layout.cropY],
    ["ne", layout.cropX + layout.cropWidth, layout.cropY],
    ["sw", layout.cropX, layout.cropY + layout.cropHeight],
    ["se", layout.cropX + layout.cropWidth, layout.cropY + layout.cropHeight],
  ];
  return corners.find(([, cornerX, cornerY]) => Math.hypot(x - cornerX, y - cornerY) <= 24)?.[0] ?? null;
}

export function insideCrop(x: number, y: number, layout: CropLayout): boolean {
  return x >= layout.cropX && x <= layout.cropX + layout.cropWidth
    && y >= layout.cropY && y <= layout.cropY + layout.cropHeight;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
