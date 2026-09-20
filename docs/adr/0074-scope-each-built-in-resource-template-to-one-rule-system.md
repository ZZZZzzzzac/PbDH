# Scope Each Built-in Resource Template to One Rule System

Status: accepted

Built-in Resource Templates in `packages/templates` default to Daggerheart semantics. A built-in Template declares exactly the fields its owning rule system consumes and never carries fields whose only consumer is a different system, migrated or not. When another rule system needs a different data contract for the same card concept, that system gets its own Template, named after the owning system or product, instead of extra optional fields in the default Template.

`子职业` therefore keeps only the Daggerheart subclass contract (名称、原文、类型、主职、等级、施法属性、特性、简介). 罗德岛旅记（tttri）subclasses use the dedicated `罗德岛子职@1.0.0` Template, which owns 阶段、推荐次领域、武器原型、子职提升 and the coverage-semantics 子职特性/职业特性/希望特性 fields, and routes to the tttri `subclasses`（干员）library through that system package's Resource Compatibility declarations.

## Consequences

- A built-in Template is a contract for one rule system; adding a field for another system's consumption is a defect and is corrected by moving that field into a dedicated Template, not by keeping it as ignored data.
- A system-specific Template is created at `1.0.0`, registered in `catalog.json` with a complete Core capability, authoring editor, and card renderer, and defaults to publication in both development and production so Creator can author it and Market can publish it.
- Correcting a default Template that was previously widened for a foreign system is done in place when the foreign fields were never part of that Template's own contract; a change to the owning system's own fields still follows the ordinary version rules.
- Player, conversion, and sheet adapters may branch on Template ID, but only to serve that Template's owning system. `子职业` keeps Daggerheart semantics (a subclass reads its 职业特性 from its 主职), while `罗德岛子职` keeps the resource's own coverage fields untouched.
- Resource data is retagged, not rewritten, when a system package adopts a dedicated Template. Migrating a package therefore repacks the `.pbres`, updates the embedded resource index digest, declares the new Template in the system package, and leaves every `data` field byte-identical.
- A system package's Resource Compatibility list is its own routing table: one entry per Template, each naming the native entry it merges into. Because `nativeEntry.id` identifies the merged library and must stay unique inside a package, adopting a dedicated Template replaces the entry for the Template the package's resources no longer use rather than pointing two Templates at one library. Resources from another system's Templates stay unmatched in that runtime instead of being merged into the package's own libraries.
- The Free Template remains the only open extension hatch for arbitrary fields. Structured per-system contracts are never smuggled into a default Template or expressed as Free Template resources when a dedicated Template is warranted.
- External format conversion keeps mapping each source kind to the default Template for that kind. A dedicated system Template participates in conversion only where that system's own package round-trips, so importing a third-party subclass card still produces `子职业`.
- Auditing an existing widening compares every registered Template's schema fields against the fields present in each system package's resources. A field that only one package populates on an otherwise shared Template is the signal to split, while a Template's explicit `additionalProperties: { type: "string" }` hatch is a sanctioned per-system extension slot rather than a widening.
