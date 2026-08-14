# Open Characters with Missing Resource Diagnostics

Status: accepted

A missing System Package blocks opening a Character Save because Player App cannot interpret the character's sheet, modules, or data projection without its rule definition. A missing or currently unusable Resource Package does not block the character. Player App opens all unaffected character state and replaces each affected resource presentation with an explicit missing-resource placeholder and diagnostic.

The placeholder preserves the stable Game Resource and Resource Package references carried by the Character Save. Card positions, instance state, selections, and other character-owned data remain intact, but commands that require the unavailable resource or Template definition cannot execute. Installing a matching Resource Package and passing normal compatibility checks resolves the original references without rewriting or guessing them.

This makes cloud recovery and offline use resilient while keeping Character Save separate from resource data. A missing optional dependency cannot make unrelated health, attributes, notes, or other available resources inaccessible.

## Consequences

- Character load distinguishes fatal System Package failures from degradable resource dependency diagnostics.
- Missing-resource UI must identify the absent dependency and offer Market installation or manual upload when available; an empty card or silent omission is not acceptable.
- Saving or exporting a degraded character preserves unresolved references and instance state.
- Resources routed to Other Resources do not automatically satisfy a character reference. They become usable only when Current System Package exposes the required integration and normal compatibility rules resolve them.
- Once dependencies resolve, placeholders disappear from the live projection without mutating the Character Save solely to record recovery.
