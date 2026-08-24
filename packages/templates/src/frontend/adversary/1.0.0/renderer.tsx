import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import type { ReactNode } from "react";

import type { AdversaryData } from "../../../core/index.ts";
import {
  adversaryRendererRevision as legacyAdversaryRendererRevision,
  type AdversaryRuntimeState,
} from "../1.0.0-alpha.1/renderer.tsx";

export type { AdversaryRuntimeState } from "../1.0.0-alpha.1/renderer.tsx";
export {
  adversaryCardDesignSource,
  adversaryRendererStyles,
} from "../1.0.0-alpha.1/renderer.tsx";

export const adversaryRendererRevision: RendererRevisionCapability<
  AdversaryData,
  AdversaryRuntimeState,
  ReactNode
> = {
  ...legacyAdversaryRendererRevision,
  templateVersion: "1.0.0",
};
