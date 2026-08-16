# Open Characters with Missing Resource Diagnostics

Status: accepted

ADR-0052 supersedes this decision's Resource Package reference, placeholder, and later-resolution rules. Missing System Package and unavailable Template diagnostics remain accepted; materialized character fields do not become missing merely because their source Resource Package is absent.

A missing System Package blocks opening a Character Save because Player App cannot interpret the character's sheet, modules, or data projection without its rule definition. A missing or currently unusable Resource Package does not affect already materialized character fields: those values are Character Data and remain available without their source package. An unavailable exact Template may still prevent a self-contained Tabletop Instance Resource Copy from rendering or executing Template-owned commands, but it does not erase the copy or unrelated character state.

Tabletop positions, instance state, selections, self-contained resource copies, and other character-owned data remain intact. An unavailable Template produces an explicit diagnostic and disables only commands or rendering that require that exact Template; installing a Resource Package is not a Character Save recovery step and never rewrites materialized character fields.

This makes cloud recovery and offline use resilient while keeping Character Save independent from the installed resource library. Resource Manager availability affects future selections, not values already committed to Character Data.

## Consequences

- Character load distinguishes fatal System Package failures from degradable exact-Template diagnostics for self-contained tabletop copies.
- Saving or exporting a degraded character preserves the complete materialized Character Data and Tabletop Instance Resource Copies.
- Resources routed to Other Resources become available for future character selections only when Current System Package exposes the required integration; they do not resolve or refresh existing character fields.
- Once an exact Template becomes available, the existing self-contained tabletop copy can render again without rewriting the Character Save solely to record recovery.
