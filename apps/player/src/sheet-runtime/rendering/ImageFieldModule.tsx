import { X } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import type { PlayerImageValue } from "../domain/characterData";
import type { ImageFieldModule as ImageFieldModuleConfig } from "../domain/systemPackage";
import { useRuntimeStore } from "../store/runtimeStore";
import { PlayerImageCropDialog } from "./PlayerImageCropDialog";
import type { PlayerImageCropSelection } from "./playerImageCrop";

interface ImageFieldModuleProps {
  module: ImageFieldModuleConfig;
}

export function ImageFieldModule({ module }: ImageFieldModuleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const value = useRuntimeStore((state) => state.characterData?.character.values[module.ID]);
  const playerImages = useRuntimeStore((state) => state.characterData?.playerImages ?? {});
  const uploadPlayerImage = useRuntimeStore((state) => state.uploadPlayerImage);
  const removePlayerImage = useRuntimeStore((state) => state.removePlayerImage);
  const imageValue = isPlayerImageValue(value) ? value : null;
  const image = imageValue ? playerImages[imageValue.imageId] : undefined;
  const altText = module.替代文本 ?? module.标签;

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setProcessingError(null);
    setPendingFile(file);
    event.target.value = "";
  };

  const applyCrop = async (selection: PlayerImageCropSelection) => {
    if (!pendingFile) return;
    setProcessing(true);
    setProcessingError(null);
    try {
      await uploadPlayerImage(module.ID, pendingFile, { crop: selection });
      setPendingFile(null);
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : "图片处理失败，请重试。");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <figure className="container container-stack image" data-module-id={module.ID} data-module-type={module.类型} data-part="container">
      <figcaption className="label" data-part="label">{module.标签}</figcaption>
      <div className="image-surface-frame" data-part="surface-frame">
        <button
          className="image-upload-surface"
          data-part="surface"
          type="button"
          aria-label={`${imageValue ? "更换" : "上传"}${module.标签}`}
          onClick={() => inputRef.current?.click()}
        >
          {image ? (
            <img className="value image-preview" data-part="image" src={image.dataUrl} alt={altText} />
          ) : (
            <span className="image-fallback" data-part="image-fallback">点击上传图片</span>
          )}
        </button>
        {imageValue ? (
          <button className="image-remove-button" data-part="remove-button" type="button" aria-label={`移除${module.标签}`} onClick={() => void removePlayerImage(module.ID)}>
            <X aria-hidden="true" size={16} />
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        className="visually-hidden"
        data-part="input"
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        aria-label={`${module.标签}图片文件`}
        onChange={handleFileChange}
      />
      {pendingFile ? (
        <PlayerImageCropDialog
          file={pendingFile}
          label={module.标签}
          working={processing}
          processingError={processingError}
          onCancel={() => { setPendingFile(null); setProcessingError(null); }}
          onConfirm={(selection) => void applyCrop(selection)}
        />
      ) : null}
    </figure>
  );
}

function isPlayerImageValue(value: unknown): value is PlayerImageValue {
  return typeof value === "object" && value !== null && "kind" in value && (value as PlayerImageValue).kind === "player-image";
}
