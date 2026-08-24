import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import type { ReactNode } from "react";

import type { WeaponData } from "../../../core/index.ts";
import {
  weaponRendererRevision as legacyWeaponRendererRevision,
  type WeaponRuntimeState,
} from "../1.0.0-alpha.1/renderer.tsx";

export type { WeaponRuntimeState } from "../1.0.0-alpha.1/renderer.tsx";
export {
  weaponCardDesignSource,
  weaponRendererStyles,
} from "../1.0.0-alpha.1/renderer.tsx";

export const weaponRendererRevision: RendererRevisionCapability<
  WeaponData,
  WeaponRuntimeState,
  ReactNode
> = {
  ...legacyWeaponRendererRevision,
  templateVersion: "1.0.0",
};
