# Scope the SealDice text experience projection

Status: accepted

The requested Daggerheart Core “export to SealDice” copies one native `.st` command containing numeric assignments and a small `DH经历` JSON string. It includes only up to five experience names and integer modifiers, including zero; exporting an empty list replaces previously stored experiences. It never includes images or other reference text.

The existing declarative character text export contract supports integer scalar fields and cannot compose this list. Unlike the script-based character file adapters in ADR 0040, this bounded clipboard integration currently keeps its system-specific projection in `daggerheartSealDiceExport.ts`, called only for the exact Daggerheart Core UUID (from generated preset metadata) / `sealdice` pair. This is an explicit exception to shipping all external format interpretation with a system package. It does not introduce new platform character fields, change Character Save or database schemas, or affect other systems. A future generalized author-owned text adapter interface should absorb this projection rather than grow a set of core rule cases.

Malformed experience names or modifiers block export with a visible error before clipboard writes. The DiceScript quoting is validated against the unchanged official SealDice binary; player-facing execution uses existing `.st` and character-card APIs without host patches.
