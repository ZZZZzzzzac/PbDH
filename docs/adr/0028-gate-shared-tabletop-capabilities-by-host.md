# Gate Shared Tabletop Capabilities by Host

Status: accepted

Shared Tabletop Core and React Surface will implement the mature generic capability superset, including placement, selection, movement, z-order, rotation, flipping, uniform scaling, duplication, deletion, deterministic arrangement, arbitrary intrinsic card dimensions, and Template-owned runtime state. The Core has no Player or GM role branches.

Each host supplies a Tabletop Capability Set. Player App exposes only capabilities permitted by its Player tabletop and Current System Package context. GM App may expose the full mature generic set and accepts any Game Resource. Surface controls and Core command validation consume the same Set.

## Consequences

- Adding a mature generic capability to Core does not automatically expose it in either App; each host opts in through its Capability Set and surrounding UI.
- A hidden or disabled button is not a security or state invariant. Core rejects commands absent from the supplied Set.
- Host-specific document management, cloud synchronization, resource preparation, character ownership, and GM workflow remain outside shared Core.
- Template Runtime State commands require both Template declaration and host capability; neither alone bypasses the other.
- Player and GM adapters may persist different document envelopes while sharing command semantics and Surface behaviour.
- Capability fixtures prove that the same allowed command yields the same state transition in both hosts and that forbidden commands are no-ops with explicit diagnostics.
