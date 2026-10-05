# SealDice numeric text export

Status: accepted

The Daggerheart Core export to SealDice uses the existing declarative character text export to copy one native .st command containing numeric attributes, resource values and gold units. It does not export experiences or any JSON payload. This also applies outside iframe mode.

Experiences remain in the PbDH Character Save. The iframe roll assistant adds selected modifiers to a numeric .dd or .ddr expression and passes hope or hopeN for the current Hope cost. A user typing commands elsewhere adds experience modifiers and the Hope cost manually.

No Daggerheart-specific experience projection is present in the Platform formatter. Experience names and modifiers, including malformed or blank values, cannot block numeric export. No Character Save, database or cloud document schema changes are required. All Dice execution uses public plugin interfaces and the unchanged official host.
