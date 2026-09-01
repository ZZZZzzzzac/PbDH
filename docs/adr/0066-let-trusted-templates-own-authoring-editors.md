# Let Trusted Templates Own Authoring Editors

Status: accepted

Each trusted Resource Template frontend owns its complete authoring editor implementation, including React structure, CSS, field placement, input choice and template-specific editing interactions. Creator and GM mount that implementation through one small interface that supplies the current resource data and accepts the next complete resource data. The host owns persistence, permissions, document selection and replacement binding; it does not generate or reinterpret the Template's definition fields.

The checked-in Template JSX/HTML/CSS is the only visual source under ADR-0068; no external canvas or generated design mapping is maintained beside it.

Shared authoring controls may provide optional behaviour and accessibility primitives, but they do not define a universal field layout. Imported Resource Packages never carry executable editor code; executable implementations remain compiled first-party code in `packages/templates/frontend` under ADR-0002.

This supersedes ADR-0022 only where it requires an authoring layout to be resolved through the exact Template facade. The facade now resolves a Template-owned authoring editor. Canonical Renderer Revision versioning remains unchanged.

Authoring-editor-only visual changes such as typography, spacing, field order, label placement and control arrangement do not change persisted resource data or runtime semantics and therefore do not require a Resource Template SemVer change. Adding, removing or changing editable data fields, validation semantics, Renderer output or tabletop behaviour remains versioned under ADR-0008 and ADR-0041.

## Consequences

- Creator Workspace and GM instance editing mount the same exact Template-owned editor with different data targets.
- A Template may freely implement layouts that cannot be reduced to a common field grid.
- The platform does not grow a low-code authoring-layout DSL or flags for every visual exception.
- Tests cross the authoring interface and assert rendered controls plus emitted complete data instead of testing a generic layout interpreter.
- The legacy `AuthoringLayout` model and generic field-generating surface are removed after all eleven first-party Templates migrate.
