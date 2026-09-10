import Ajv2020 from "ajv/dist/2020.js";

import { validateResourcePackageCandidate } from "../apps/player/src/resources/resource-package-validator.ts";
import { loadPbres } from "../packages/contract-runtime/src/index.ts";
import { templateRegistry } from "../packages/templates/src/core/index.ts";

export async function loadValidatedCoreBook(bytes: Uint8Array, playerTemplateIds: ReadonlySet<string>) {
  const loaded = await loadPbres(bytes, validateResourcePackageCandidate);
  if (!loaded.candidate) {
    throw new Error(`Invalid core book archive: ${JSON.stringify(loaded.diagnostics)}`);
  }
  const { resources } = loaded.candidate.document;
  if (!resources.length) throw new Error("Core book resource scope must be nonempty.");
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validators = new Map<string, ReturnType<typeof ajv.compile>>();
  for (const resource of resources) {
    const { id, version } = resource.template;
    if (!playerTemplateIds.has(id)) throw new Error(`Non-player core book Template: ${id}@${version}`);
    const key = `${id}@${version}`;
    let validate = validators.get(key);
    if (!validate) {
      const template = templateRegistry.resolve(id, version);
      if (!template) throw new Error(`Unknown core book Template: ${key}`);
      validate = ajv.compile(template.schema);
      validators.set(key, validate);
    }
    if (!validate(resource.data)) {
      throw new Error(`Invalid core book resource data: ${resource.id}/${key}: ${JSON.stringify(validate.errors)}`);
    }
  }
  return loaded.candidate;
}
