import {
  loadPbres,
  type ContractDiagnostic,
  type SystemPackageDocument,
} from "@pbdh/contract-runtime";

import {
  planResourcePackageInstall,
  type ResourceLibrary,
  type ResourcePackageInstallPlan,
} from "./resource-library.ts";
import {
  playerMarketHandoffMismatch,
  type PlayerMarketHandoff,
} from "./market-handoff.ts";
import { validateResourcePackageCandidate } from "./resource-package-validator.ts";

export type ResourcePackageInstallPreparation =
  | { kind: "ready"; plan: ResourcePackageInstallPlan }
  | { kind: "invalid"; diagnostics: ContractDiagnostic[] };

export async function prepareResourcePackageInstall({
  bytes,
  currentSystem,
  library,
  expectedMarketHandoff,
}: {
  bytes: Uint8Array;
  currentSystem: SystemPackageDocument;
  library: ResourceLibrary;
  expectedMarketHandoff?: PlayerMarketHandoff;
}): Promise<ResourcePackageInstallPreparation> {
  const result = await loadPbres(bytes, validateResourcePackageCandidate);
  if (!result.candidate) return { kind: "invalid", diagnostics: result.diagnostics };
  if (expectedMarketHandoff) {
    const mismatch = playerMarketHandoffMismatch(expectedMarketHandoff, result.candidate);
    if (mismatch) return {
      kind: "invalid",
      diagnostics: [{
        code: mismatch,
        severity: "error",
        family: "player",
        version: "1",
        location: "/publication",
        params: {},
      }],
    };
  }
  return {
    kind: "ready",
    plan: planResourcePackageInstall({ currentSystem, library, candidate: result.candidate }),
  };
}
