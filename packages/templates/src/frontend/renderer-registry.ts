import {
  adversaryRendererRevision as legacyAdversaryRendererRevision,
} from "./adversary/1.0.0-alpha.1/renderer.tsx";
import { adversaryRendererRevision } from "./adversary/1.0.0/renderer.tsx";
import { freeRendererRevision } from "./free/1.0.0/renderer.tsx";
import { armorRendererRevision } from "./armor/1.0.0/renderer.tsx";
import {
  weaponRendererRevision as legacyWeaponRendererRevision,
} from "./weapon/1.0.0-alpha.1/renderer.tsx";
import { weaponRendererRevision } from "./weapon/1.0.0/renderer.tsx";

export function adversaryRendererFor(version: string) {
  if (version === legacyAdversaryRendererRevision.templateVersion) {
    return legacyAdversaryRendererRevision;
  }
  if (version === adversaryRendererRevision.templateVersion) {
    return adversaryRendererRevision;
  }
  throw new Error(`Unsupported adversary Renderer version: ${version}`);
}

export function weaponRendererFor(version: string) {
  if (version === legacyWeaponRendererRevision.templateVersion) {
    return legacyWeaponRendererRevision;
  }
  if (version === weaponRendererRevision.templateVersion) {
    return weaponRendererRevision;
  }
  throw new Error(`Unsupported weapon Renderer version: ${version}`);
}

export function freeRendererFor(version: string) {
  if (version === freeRendererRevision.templateVersion) return freeRendererRevision;
  throw new Error(`Unsupported free Renderer version: ${version}`);
}

export function armorRendererFor(version: string) {
  if (version === armorRendererRevision.templateVersion) return armorRendererRevision;
  throw new Error(`Unsupported armor Renderer version: ${version}`);
}
