# Keep Rule Semantics out of Creator and GM Apps

Status: accepted

Creator App and GM App will not model rules or System Packages. A value such as “Daggerheart” or another rule name is ordinary Game Resource tag metadata used for organization and discovery. Neither App loads a System Package or interprets its Resource Compatibility, and GM App does not restrict its card tabletop by rule identity.

The optional Player-facing Target System Package Reference belongs to Resource Package construction and import. When present, it lets Player App safely gate an installed package; it does not turn Creator Workspace or a GM tabletop document into a system-aware runtime. Creator may leave it absent when the rule system has no System Package yet or the package is intended outside Player App.

## Consequences

- Creator may author a Game Resource from a registered Resource Template or Free Template without selecting or installing a System Package implementation.
- Resource tags can include rule names alongside any other classification and do not grant compatibility.
- GM App can place any available resource card together, including resources carrying different rule tags or packaged for different Player systems.
- Creator App and GM App search and organization may filter tags but cannot hide or reject a resource because of a current rule context; no such context exists.
- Packaging or Market publication preserves at most one optional Target System Package Reference without changing the contained resource definitions. Neither Creator nor Market requires the referenced System Package to exist.
- Player App remains the only place where target ID, target `MAJOR`, and Resource Compatibility have runtime consequences.
