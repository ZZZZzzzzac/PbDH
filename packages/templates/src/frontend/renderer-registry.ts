import {
  adversaryRendererRevision as legacyAdversaryRendererRevision,
} from "./adversary/1.0.0-alpha.1/renderer.tsx";
import { adversaryRendererRevision } from "./adversary/1.0.0/renderer.tsx";
import { freeRendererRevision } from "./free/1.0.0/renderer.tsx";
import { armorRendererRevision } from "./armor/1.0.0/renderer.tsx";
import { ancestryRendererRevision } from "./ancestry/1.0.0/renderer.tsx";
import { communityRendererRevision } from "./community/1.0.0/renderer.tsx";
import { domainRendererRevision } from "./domain/1.0.0/renderer.tsx";
import { environmentRendererRevision } from "./environment/1.0.0/renderer.tsx";
import { itemRendererRevision } from "./item/1.0.0/renderer.tsx";
import { professionRendererRevision } from "./profession/1.0.0/renderer.tsx";
import { subclassRendererRevision } from "./subclass/1.0.0/renderer.tsx";
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

export function ancestryRendererFor(version: string) {
  if (version === ancestryRendererRevision.templateVersion) return ancestryRendererRevision;
  throw new Error(`Unsupported ancestry Renderer version: ${version}`);
}

export function communityRendererFor(version: string) {
  if (version === communityRendererRevision.templateVersion) return communityRendererRevision;
  throw new Error(`Unsupported community Renderer version: ${version}`);
}

export function professionRendererFor(version: string) {
  if (version === professionRendererRevision.templateVersion) return professionRendererRevision;
  throw new Error(`Unsupported profession Renderer version: ${version}`);
}

export function subclassRendererFor(version: string) {
  if (version === subclassRendererRevision.templateVersion) return subclassRendererRevision;
  throw new Error(`Unsupported subclass Renderer version: ${version}`);
}

export function itemRendererFor(version: string) {
  if (version === itemRendererRevision.templateVersion) return itemRendererRevision;
  throw new Error(`Unsupported item Renderer version: ${version}`);
}

export function domainRendererFor(version: string) {
  if (version === domainRendererRevision.templateVersion) return domainRendererRevision;
  throw new Error(`Unsupported domain Renderer version: ${version}`);
}

export function environmentRendererFor(version: string) {
  if (version === environmentRendererRevision.templateVersion) return environmentRendererRevision;
  throw new Error(`Unsupported environment Renderer version: ${version}`);
}
