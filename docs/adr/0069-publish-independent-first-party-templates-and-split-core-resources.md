# Publish Independent First-party Templates and Split Core Resources

Status: accepted

The eleven first-party Resource Templates at `1.0.0` will complete their development lifecycle with one final data-field normalization and then enter `published`. Each Template owns its complete Renderer composition, DOM and CSS. Templates may share only semantic-free authoring and rendering primitives such as dropdown controls, restricted Markdown, text fitting and the card footer; they do not share a complete card model, card container, DOM tree or template-level stylesheet.

The final field vocabulary distinguishes descriptive text from game mechanics. Top-level resource identity uses `名称` and optional `原文`. Non-mechanical flavor text uses `简介`. Independent feature records use `特性名称`, optional `特性原文`, `特性描述` and, only where the Template has that concept, `特性类型`. Domain Card and Item mechanics use top-level `特性描述`. Free resources use a required top-level `简介` and retain a `内容` array whose records use `名称`, optional `原文` and `描述` because those records are generic content blocks rather than features.

Daggerheart Core resources are rebuilt from the paired English and Chinese records in the selected SRD2 ParaTranz export. The existing embedded Resource Package remains the player-facing package and excludes Adversary and Environment resources. A second embedded Resource Package contains only Adversary and Environment resources for GMs. Both packages target the same Daggerheart System Package and are versioned independently.

This decision supersedes ADR-0067's development status and completes the release approval required there. Once the catalog and compiled capabilities enter `published`, ADR-0041 applies and the exact `1.0.0` Schemas, authoring editors and Renderer Revisions become immutable.

## Consequences

- The shared `reference-card` Renderer factory is retired after Community, Domain Card, Item and Subclass receive independent implementations. Profession also stops importing its stylesheet.
- Development-era local drafts and Resource data using the retired field vocabulary are intentionally incompatible with the published `1.0.0` Templates; no automatic migration or field fallback is provided.
- SRD2 extraction pairs each `original` record with its `translation`; English structure and names are never reconstructed from mixed translated text.
- Extraction is fail-closed. Unparsed rows, missing required fields, duplicate resource identities or mismatched English/Chinese table rows prevent package generation and produce a review report.
- Every embedded Resource Package whose resource data changes receives a new patch version so installed browser snapshots are replaced normally.
- The Resource Package ZIP entry limit rises from 1024 to 2048 so the single player package can carry 956 resources plus retained card art; per-file and total expanded-size limits remain unchanged.
