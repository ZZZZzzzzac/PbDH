import { Ellipsis } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CardInstance } from "../../domain/cardEngine";
import type { CardPresentation } from "../../domain/cardPresentation";
import { findResourceEntryProvenance } from "../../domain/effectiveResourceCatalog";
import type { ResourceLibraryEntry } from "../../domain/resourceLibrary";
import type { CardTableModule } from "../../domain/systemPackage";
import { resourceAssetUrlKey } from "../../loaders/assetResolver";
import { useRuntimeStore } from "../../store/runtimeStore";
import { RestrictedMarkdown } from "../RestrictedMarkdown";
import { useCardDescriptionFit } from "../cardDescriptionFit";
import {
  cardField,
  resolveCardDisplayMode,
  resolveRenderedCardPresentation,
} from "./cardDefinition";

export function CardFace({
  definition,
  definitionRef,
  module,
  presentation,
  fallbackName,
  autoFitDescription = true,
}: {
  definition?: ResourceLibraryEntry;
  definitionRef?: CardInstance["definitionRef"];
  module: CardTableModule;
  presentation?: CardPresentation;
  fallbackName: string;
  autoFitDescription?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const resourceCatalog = useRuntimeStore((state) => state.resourceCatalog);
  const artField = cardField(module, "卡图字段");
  const cardArtRef = definition?.fields[artField] ?? "";
  const libraryId = definitionRef?.type === "resourceLibrary" ? definitionRef.libraryId : undefined;
  const provenance = findResourceEntryProvenance(resourceCatalog, libraryId, definition?.ID);
  const cardArtUrlKey = cardArtRef.startsWith("resource-extension:")
    ? cardArtRef
    : resourceAssetUrlKey(provenance?.type, provenance?.id, cardArtRef);
  const cardArtUrl = useRuntimeStore((state) => cardArtRef
    ? /^(?:blob:|data:)/u.test(cardArtRef) ? cardArtRef : state.packageAssetUrls[cardArtUrlKey]
    : undefined);
  const displayMode = resolveCardDisplayMode(definition, module);
  const showArt = displayMode !== "text" && cardArtUrl && !imageFailed;
  useEffect(() => setImageFailed(false), [cardArtRef, cardArtUrl]);

  if (showArt && displayMode === "image") {
    return <img className="play-card-image" src={cardArtUrl} alt={fallbackName} draggable={false} onError={() => setImageFailed(true)} />;
  }
  if (showArt && displayMode === "split") {
    return (
      <div className="play-card-split">
        <div className="play-card-split-art">
          <img className="play-card-image" src={cardArtUrl} alt={fallbackName} draggable={false} onError={() => setImageFailed(true)} />
        </div>
        <TextCard definition={definition} module={module} presentation={presentation} fallbackName={fallbackName} autoFitDescription={autoFitDescription} split />
      </div>
    );
  }
  return <TextCard definition={definition} module={module} presentation={presentation} fallbackName={fallbackName} autoFitDescription={autoFitDescription} />;
}

export function CardStateBadge({ id, label }: { id?: string; label: string }) {
  return <span id={id} className="play-card-state-badge">{label}</span>;
}

function TextCard({
  definition,
  module,
  presentation,
  fallbackName,
  autoFitDescription,
  split = false,
}: {
  definition?: ResourceLibraryEntry;
  module: CardTableModule;
  presentation?: CardPresentation;
  fallbackName: string;
  autoFitDescription: boolean;
  split?: boolean;
}) {
  const resolvedPresentation = resolveRenderedCardPresentation(definition, module, presentation);

  return (
    <div className={`play-card-text${split ? " play-card-split-text" : ""}`}>
      <header>
        <RestrictedMarkdown className="play-card-name" value={resolvedPresentation.name || fallbackName} />
        {resolvedPresentation.tags.length > 0 ? (
          <div className="play-card-tags" aria-label="卡牌标签">
            {resolvedPresentation.tags.map((tag, index) => (
              <RestrictedMarkdown className="play-card-tag" value={tag} key={`${tag}:${index}`} />
            ))}
          </div>
        ) : null}
      </header>
      <CardDescription value={resolvedPresentation.description} autoFit={autoFitDescription} />
    </div>
  );
}

function CardDescription({ value, autoFit }: { value: string; autoFit: boolean }) {
  const descriptionRef = useRef<HTMLDivElement>(null);
  const overflowing = useCardDescriptionFit(descriptionRef, value, autoFit);
  return (
    <>
      <RestrictedMarkdown className="play-card-description" value={value} elementRef={descriptionRef} />
      {autoFit && overflowing ? (
        <span
          className="play-card-description-overflow"
          role="img"
          aria-label="卡牌描述未完全显示；查看卡牌详情可阅读完整内容"
          title="卡牌描述未完全显示；查看卡牌详情可阅读完整内容"
        >
          <Ellipsis aria-hidden="true" size={16} />
        </span>
      ) : null}
    </>
  );
}
