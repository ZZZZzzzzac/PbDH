# Render Template-owned Tabletop State Consistently

Status: accepted

A Canonical Card Surface may vary with its current structured resource definition and with runtime state explicitly declared by its Resource Template, such as health, stress, status values, markers, or collapsed regions. The Template owns the definition Schema plus the runtime state's Schema, defaults, generic commands, and visual effects. Given the same effective resource definition, exact Template version, Assets, and runtime state, every host must produce the same surface.

Creator App preview, Market, and non-instance resource views render the Game Resource with the Template's default state. Player App and GM App tabletops render the Tabletop Instance Resource Copy with the current Tabletop Instance state. GM may edit the private resource copy through Template-validated inputs; the host still does not implement or reinterpret the meaning or layout of definition fields, health, stress, or folding.

## Consequences

- Tabletop runtime state belongs to Tabletop Instance and never writes back into Game Resource.
- Tabletop definition edits belong to one Tabletop Instance Resource Copy and never write back into the source Game Resource or another instance.
- Creator Preview can simulate declared state and commands so the authored preview covers the same Renderer behaviour used on tables.
- Player and GM may expose different surrounding controls or permissions, but a command they both support has the same Template-defined result.
- Host selection outlines, generic table statuses, notes, and menus remain outside the Canonical Card Surface unless the Template explicitly declares them as surface state.
- Invalid or unsupported state versions produce explicit diagnostics and cannot be guessed from visible fields.
- Tabletop Document Contract versions the persisted instance state envelope; the Resource Template versions the state payload semantics.
