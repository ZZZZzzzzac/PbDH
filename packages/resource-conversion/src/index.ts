import { dhsheetAdapter } from "./adapters/dhsheet.ts";
import { kidAdapter } from "./adapters/kid.ts";
import { pbresAdapter } from "./adapters/pbres.ts";
import { rinkcxAdapter } from "./adapters/rinkcx.ts";
import { zzzAdapter } from "./adapters/zzz.ts";
import { ResourceConversionRegistry } from "./registry.ts";

export { dhsheetAdapter } from "./adapters/dhsheet.ts";
export { kidAdapter } from "./adapters/kid.ts";
export { pbresAdapter, upgradePbresTemplateVersions, validatePbresConversionCandidate } from "./adapters/pbres.ts";
export { rinkcxAdapter } from "./adapters/rinkcx.ts";
export { zzzAdapter } from "./adapters/zzz.ts";
export { ResourceConversionRegistry } from "./registry.ts";
export { materializeResourceConversion } from "./materialize.ts";
export type { ResourceConversionMaterialization } from "./materialize.ts";
export { mapBatchToRegisteredCandidates, mapTemporaryResourceToCandidate } from "./template-mapping.ts";
export type * from "./types.ts";

export const resourceConversionRegistry = new ResourceConversionRegistry([
  pbresAdapter,
  rinkcxAdapter,
  kidAdapter,
  dhsheetAdapter,
  zzzAdapter,
]);
