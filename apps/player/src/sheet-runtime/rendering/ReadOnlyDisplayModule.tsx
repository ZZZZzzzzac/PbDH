import { useState } from "react";
import type { ReadOnlyDisplayModule as ReadOnlyDisplayModuleConfig } from "../domain/systemPackage";
import { useRuntimeStore } from "../store/runtimeStore";

interface ReadOnlyDisplayModuleProps {
  module: ReadOnlyDisplayModuleConfig;
}

export function ReadOnlyDisplayModule({ module }: ReadOnlyDisplayModuleProps) {
  const [failed, setFailed] = useState(false);
  const assetUrl = useRuntimeStore((state) => (module.资源路径 ? state.packageAssetUrls[module.资源路径] : undefined));
  const derivedContent = useRuntimeStore((state) => state.derivedReadOnlyDisplayContent[module.ID]);
  const content = derivedContent ?? module.内容;
  const altText = module.替代文本 ?? module.标签;

  return (
    <article className="container container-stack" data-module-id={module.ID} data-module-type={module.类型} data-part="container">
      <h3 className="label" data-part="label">{module.标签}</h3>
      {content ? <p className="value display-text" data-part="value">{content}</p> : null}
      {module.资源路径 ? (
        assetUrl && !failed ? (
          <img className="value read-only-image" data-part="image" src={assetUrl} alt={altText} onError={() => setFailed(true)} />
        ) : (
          <div className="image-fallback" data-part="image-fallback" role="img" aria-label={altText}>
            图片不可用
          </div>
        )
      ) : null}
    </article>
  );
}
