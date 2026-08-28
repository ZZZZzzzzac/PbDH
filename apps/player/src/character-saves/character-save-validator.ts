import {
  ContractRuntime,
  validateCharacterSaveSemantics,
  type CharacterSaveCandidateValidator,
  type ContractCatalog,
} from "@pbdh/contract-runtime";

import catalogJson from "../../../../contracts/catalog.json";
import characterSaveAlpha1Schema from "../../../../contracts/character-save/1.0.0-alpha.1/schema.json";
import characterSaveSchema from "../../../../contracts/character-save/1.0.0/schema.json";

const family = (catalogJson as ContractCatalog).families.find(
  (candidate) => candidate.id === "character-save",
);
const versions = family?.versions.filter((candidate) =>
  candidate.version === "1.0.0-alpha.1" || candidate.version === "1.0.0") ?? [];
if (versions.length !== 2) throw new Error("Missing Character Save Contract readers");

const catalog: ContractCatalog = {
  catalogVersion: 1,
  families: [{ id: "character-save", versions }],
};
const runtime = new ContractRuntime(catalog, {
  "character-save/1.0.0-alpha.1/schema.json": characterSaveAlpha1Schema,
  "character-save/1.0.0/schema.json": characterSaveSchema,
});

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
