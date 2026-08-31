import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const contract = JSON.parse(readFileSync(
  "contracts/backend-api/1.0.0/openapi.json",
  "utf8",
)) as Record<string, any>;
const cases = JSON.parse(readFileSync(
  "contracts/conformance/backend-api/1.0.0/cases.json",
  "utf8",
)) as { operations: Array<[string, string, string]> };

describe("Backend API 1.0.0 consumer conformance", () => {
  test("exposes every versioned operation with stable IDs and Contract errors", () => {
    for (const [method, path, operationId] of cases.operations) {
      const operation = contract.paths[path]?.[method.toLowerCase()];
      expect(operation?.operationId).toBe(operationId);
      expect(operation?.responses.default).toEqual({
        $ref: "#/components/responses/ContractError",
      });
    }
  });

  test("describes normalized WebP upload and binary downloads", () => {
    expect(contract.paths["/api/cloud/media/{asset_id}"].put.requestBody.content["image/webp"].schema)
      .toEqual({ type: "string", format: "binary" });
    expect(contract.paths["/api/publications/{publication_id}/download"].get.responses["200"].content)
      .toHaveProperty("application/vnd.pbdh.resource-package+zip");
  });
});
