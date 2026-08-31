// 迁移来源：PbDH_Cards@0745f4e45d6bc1cb06bc7f5d7b005757546c5cbe frontend/src/media/localImagePipeline.ts。
export type ImageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageAdmissionPolicy = {
  purpose: "player-avatar" | "resource-image" | "publication-cover";
  outputWidth: number;
  fixedAspectRatio?: number;
  maxInputBytes?: number;
  maxDecodedPixels?: number;
  maxOutputBytes?: number;
};

export type ImageAdmissionSelection = {
  crop?: ImageCrop;
  outputWidth?: number;
};

export type AdmittedImage = {
  id: `sha256:${string}`;
  mediaType: "image/webp";
  byteLength: number;
  width: number;
  height: number;
  bytes: Uint8Array;
  blob: Blob;
};

export type ImageSourceInfo = {
  width: number;
  height: number;
};

export interface ImageAdmissionWorkflow {
  inspect(file: File, policy: ImageAdmissionPolicy): Promise<ImageSourceInfo>;
  admit(file: File, policy: ImageAdmissionPolicy, selection?: ImageAdmissionSelection): Promise<AdmittedImage>;
}

const defaultMaxInputBytes = 10 * 1024 * 1024;
const defaultMaxDecodedPixels = 40_000_000;
export const maxAdmittedImageBytes = 2 * 1024 * 1024;
const defaultMaxOutputBytes = maxAdmittedImageBytes;
const maxWebpDimension = 16_383;

export const resourceImagePolicy: ImageAdmissionPolicy = {
  purpose: "resource-image",
  outputWidth: 630,
};

export const publicationCoverPolicy: ImageAdmissionPolicy = {
  purpose: "publication-cover",
  outputWidth: 630,
  fixedAspectRatio: 63 / 88,
};

export const playerAvatarPolicy: ImageAdmissionPolicy = {
  purpose: "player-avatar",
  outputWidth: 512,
};

export const cropViewportWidth = 720;
export const cropViewportHeight = 540;

export interface ImageCropSelection extends ImageCrop {
  sourceWidth: number;
  sourceHeight: number;
}

export interface ImageCropLayout {
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

export type ImageCropCorner = "nw" | "ne" | "sw" | "se";

const minimumCropSize = 48;

export function initialCropLayout(sourceWidth: number, sourceHeight: number, aspectRatio?: number): ImageCropLayout {
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

export function resizeFixedCrop(layout: ImageCropLayout, corner: ImageCropCorner, x: number, y: number, aspectRatio: number): ImageCropLayout {
  const anchorX = corner.endsWith("w") ? layout.cropX + layout.cropWidth : layout.cropX;
  const anchorY = corner.startsWith("n") ? layout.cropY + layout.cropHeight : layout.cropY;
  const horizontalDirection = corner.endsWith("w") ? -1 : 1;
  const verticalDirection = corner.startsWith("n") ? -1 : 1;
  const horizontalLimit = horizontalDirection < 0 ? anchorX - layout.imageX : layout.imageX + layout.imageWidth - anchorX;
  const verticalLimit = verticalDirection < 0 ? anchorY - layout.imageY : layout.imageY + layout.imageHeight - anchorY;
  const maximumWidth = Math.min(horizontalLimit, verticalLimit * aspectRatio);
  const minimumWidth = Math.min(minimumCropSize, maximumWidth);
  const pointerWidth = Math.max(Math.abs(x - anchorX), Math.abs(y - anchorY) * aspectRatio);
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

export function moveCrop(layout: ImageCropLayout, cropX: number, cropY: number): ImageCropLayout {
  return {
    ...layout,
    cropX: clamp(cropX, layout.imageX, layout.imageX + layout.imageWidth - layout.cropWidth),
    cropY: clamp(cropY, layout.imageY, layout.imageY + layout.imageHeight - layout.cropHeight),
  };
}

export function resizeFreeCrop(layout: ImageCropLayout, corner: ImageCropCorner, x: number, y: number): ImageCropLayout {
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

export function zoomCrop(layout: ImageCropLayout, pointerX: number, pointerY: number, deltaY: number): ImageCropLayout {
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

export function cropSelectionFromLayout(layout: ImageCropLayout): ImageCropSelection {
  return {
    sourceWidth: layout.sourceWidth,
    sourceHeight: layout.sourceHeight,
    x: (layout.cropX - layout.imageX) / layout.imageScale,
    y: (layout.cropY - layout.imageY) / layout.imageScale,
    width: layout.cropWidth / layout.imageScale,
    height: layout.cropHeight / layout.imageScale,
  };
}

export function cropCornerAt(x: number, y: number, layout: ImageCropLayout): ImageCropCorner | null {
  const corners: Array<[ImageCropCorner, number, number]> = [
    ["nw", layout.cropX, layout.cropY],
    ["ne", layout.cropX + layout.cropWidth, layout.cropY],
    ["sw", layout.cropX, layout.cropY + layout.cropHeight],
    ["se", layout.cropX + layout.cropWidth, layout.cropY + layout.cropHeight],
  ];
  return corners.find(([, cornerX, cornerY]) => Math.hypot(x - cornerX, y - cornerY) <= 24)?.[0] ?? null;
}

export function insideCrop(x: number, y: number, layout: ImageCropLayout): boolean {
  return x >= layout.cropX && x <= layout.cropX + layout.cropWidth
    && y >= layout.cropY && y <= layout.cropY + layout.cropHeight;
}

export function createBrowserImageAdmission(): ImageAdmissionWorkflow {
  return {
    async inspect(file, policy) {
      validateCompressedInput(file, policy);
      const bitmap = await decodeImage(file);
      try {
        validateDecodedInput(bitmap.width, bitmap.height, policy);
        return { width: bitmap.width, height: bitmap.height };
      } finally {
        bitmap.close();
      }
    },
    async admit(file, policy, selection = {}) {
      validateCompressedInput(file, policy);
      const bitmap = await decodeImage(file);
      try {
        validateDecodedInput(bitmap.width, bitmap.height, policy);
        const crop = resolveCrop(bitmap.width, bitmap.height, policy.fixedAspectRatio, selection.crop);
        const dimensions = outputDimensions(crop, selection.outputWidth ?? policy.outputWidth);
        const outputPixels = dimensions.width * dimensions.height;
        if (dimensions.width > maxWebpDimension || dimensions.height > maxWebpDimension
          || outputPixels > (policy.maxDecodedPixels ?? defaultMaxDecodedPixels)) {
          throw new Error("图片输出尺寸过大，无法安全编码为 WebP。");
        }
        const canvas = document.createElement("canvas");
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("当前浏览器无法处理图片。");
        context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, dimensions.width, dimensions.height);
        const blob = await encodeWebp(canvas, policy.maxOutputBytes ?? defaultMaxOutputBytes);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const id = `sha256:${await digestHex(bytes)}` as const;
        return {
          id,
          mediaType: "image/webp",
          byteLength: bytes.byteLength,
          width: dimensions.width,
          height: dimensions.height,
          bytes,
          blob,
        };
      } finally {
        bitmap.close();
      }
    },
  };
}

export function centerCrop(sourceWidth: number, sourceHeight: number, aspectRatio: number): ImageCrop {
  if (sourceWidth <= 0 || sourceHeight <= 0 || aspectRatio <= 0) throw new Error("图片尺寸或裁剪比例无效。");
  let width = sourceWidth;
  let height = sourceHeight;
  if (sourceWidth / sourceHeight > aspectRatio) width = sourceHeight * aspectRatio;
  else height = sourceWidth / aspectRatio;
  return {
    x: (sourceWidth - width) / 2,
    y: (sourceHeight - height) / 2,
    width,
    height,
  };
}

export function outputDimensions(crop: Pick<ImageCrop, "width" | "height">, outputWidth: number) {
  if (crop.width <= 0 || crop.height <= 0 || !Number.isFinite(outputWidth) || outputWidth <= 0) {
    throw new Error("图片裁剪或输出尺寸无效。");
  }
  const width = Math.max(1, Math.round(outputWidth));
  return { width, height: Math.max(1, Math.round(width * crop.height / crop.width)) };
}

function resolveCrop(
  sourceWidth: number,
  sourceHeight: number,
  fixedAspectRatio: number | undefined,
  selection: ImageCrop | undefined,
): ImageCrop {
  const crop = selection ?? (fixedAspectRatio
    ? centerCrop(sourceWidth, sourceHeight, fixedAspectRatio)
    : { x: 0, y: 0, width: sourceWidth, height: sourceHeight });
  if (crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0
    || crop.x + crop.width > sourceWidth || crop.y + crop.height > sourceHeight) {
    throw new Error("裁剪区域超出图片范围。");
  }
  if (fixedAspectRatio && Math.abs(crop.width / crop.height - fixedAspectRatio) > 0.001) {
    throw new Error("裁剪区域不符合固定比例。");
  }
  return crop;
}

function validateCompressedInput(file: File, policy: ImageAdmissionPolicy) {
  if (file.size > (policy.maxInputBytes ?? defaultMaxInputBytes)) {
    throw new Error("图片压缩体积超过 10 MB 限制，请先缩小后重试。");
  }
  if (!/\.(?:jpe?g|png|webp)$/iu.test(file.name)) {
    throw new Error("仅支持 JPEG、PNG 和 WebP 光栅图片。");
  }
}

function validateDecodedInput(width: number, height: number, policy: ImageAdmissionPolicy) {
  if (width <= 0 || height <= 0) throw new Error("图片尺寸无效。");
  if (width * height > (policy.maxDecodedPixels ?? defaultMaxDecodedPixels)) {
    throw new Error("图片解码后超过 4000 万像素限制，请缩小尺寸。");
  }
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("图片已损坏或无法解码，请更换文件。");
  }
}

async function encodeWebp(canvas: HTMLCanvasElement, maxOutputBytes: number): Promise<Blob> {
  for (const quality of [0.9, 0.85, 0.8, 0.75]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob || blob.type !== "image/webp") throw new Error("当前浏览器不支持 WebP 图片处理。");
    if (blob.size <= maxOutputBytes) return blob;
  }
  throw new Error("图片无法在可接受画质下压缩到 2 MB，请调整裁剪区域或更换图片。");
}

async function digestHex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
