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
const defaultMaxOutputBytes = 5 * 1024 * 1024;
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
  fixedAspectRatio: 1,
};

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
  throw new Error("图片无法在可接受画质下压缩到 5 MB，请降低尺寸或复杂度。");
}

async function digestHex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
