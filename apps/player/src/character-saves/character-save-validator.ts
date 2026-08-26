import {
  ContractRuntime,
  validateCharacterSaveSemantics,
  type CharacterSaveCandidateValidator,
  type ContractCatalog,
} from "@pbdh/contract-runtime";

import catalogJson from "../../../../contracts/catalog.json";
import characterSaveSchema from "../../../../contracts/character-save/1.0.0-alpha.1/schema.json";

const family = (catalogJson as ContractCatalog).families.find(
  (candidate) => candidate.id === "character-save",
);
const version = family?.versions.find((candidate) => candidate.version === "1.0.0-alpha.1");
if (!version) throw new Error("Missing Character Save Contract 1.0.0-alpha.1");

const catalog: ContractCatalog = {
  catalogVersion: 1,
  families: [{ id: "character-save", versions: [version] }],
};
const runtime = new ContractRuntime(catalog, { [version.schema]: characterSaveSchema });

export const validateCharacterSaveCandidate: CharacterSaveCandidateValidator = async (
  document,
  media,
) => {
  const schemaDiagnostics = runtime.validate({
    family: "character-save",
    version: document.contractVersion,
    mode: "development",
    candidate: document,
  });
  return schemaDiagnostics.length > 0
    ? schemaDiagnostics
    : validateCharacterSaveSemantics(document, media);
};
