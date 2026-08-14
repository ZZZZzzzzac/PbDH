# Use Language-neutral Contract Schemas

Status: accepted

JSON Schema will be the authoritative definition for file, package, persisted-document, and Resource Template data contracts. OpenAPI will be the authoritative definition for Platform Backend HTTP contracts. Representations in every implementation language actually used by a contract consumer must be generated from those schemas or verified against the same versioned conformance fixtures; no language's handwritten types are contract authority.

Resource Templates contain two deliberately separated parts. Their language-neutral data Schema is available to Apps and the Platform Backend for structural validation. Their trusted frontend implementation provides editors, renderers, and Tabletop Behaviors and runs only in the Apps through the compiled Template Registry. Market and sync backend modules never execute frontend Template code.

## Consequences

- Every published Contract or Template version has an immutable schema artifact for that exact version.
- Resource Package, System Package, and Tabletop Document boundaries validate their JSON data before conversion into application domain objects.
- Backend request and response implementations are checked against the versioned OpenAPI document, including error payloads and synchronization protocol messages.
- Generated types are build artifacts or implementation aids; editing one cannot change the contract without first changing its authoritative schema version.
- Validation rules the backend must enforce must be expressible in the authoritative Schema or in an explicitly versioned backend rule. A frontend-only callback cannot be the sole publication trust check.
- Schema validation establishes contract shape, not Resource Compatibility, authorization, referential integrity, or application policy; those remain explicit domain steps.
- Examples and conformance fixtures supplement the Schema but cannot silently redefine it.
