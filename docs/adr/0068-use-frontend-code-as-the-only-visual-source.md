# Use Frontend Code as the Only Visual Source

Status: accepted

PbDH no longer maintains OpenPencil documents or an `.op`-to-code generation pipeline. The checked-in React/HTML/CSS implementation is the only visual source for every frontend surface.

Each trusted Resource Template owns its authoring editor and Canonical Card Surface in `packages/templates/src/frontend/<template>/<version>/`. A Template's JSX structure and CSS styles are authoritative for field layout, typography, spacing, card composition and responsive behaviour. Apps only mount these Template-owned surfaces and must not keep a parallel visual specification for them.

App-level visual constants that are consumed directly by production code remain ordinary reviewed TypeScript source. They are not generated artifacts and do not claim to mirror an external design document.

## Consequences

- `.op` files, OpenPencil generators, synchronization scripts and generated design-mapping files are removed.
- Visual review uses the real local application in a browser at representative sizes and states.
- Automated tests may lock structure, behaviour and selected style invariants, but passing DOM geometry checks cannot replace browser screenshot inspection for visual bugs.
- A visual change is made once in the owning frontend implementation. No second canvas or generated mapping needs to be kept in sync.
