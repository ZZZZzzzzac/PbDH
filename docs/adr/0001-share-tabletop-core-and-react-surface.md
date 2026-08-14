# Share Tabletop Core and React Surface

Status: accepted

Player App and GM App will share both the pure tabletop state/command Module and the React spatial-surface Module. Each host supplies an Adapter for its owned data, persistence, capabilities, and surrounding UI; shared Modules must not depend on Character Data, System Package, GM documents, authentication, or storage.

Sharing only state commands would duplicate the difficult drag, touch, keyboard, accessibility, layout, menu, and detail behaviour. Sharing the existing Sheet table wholesale would instead leak Sheet ownership into GM workflows. The Adapter seam keeps those host concerns outside while allowing interaction defects and improvements to be implemented once.

## Consequences

- Tabletop Core accepts tabletop state and commands, then returns results without performing persistence.
- React Surface consumes host-provided resource rendering and capabilities, then emits shared commands.
- Player and GM persistence models may differ without forking tabletop behaviour.
- Host-specific controls remain outside the shared surface unless both hosts need the same behaviour.
- Tabletop Core implements the mature generic capability superset without knowing Player or GM. Each host supplies a Capability Set that both Surface and Core enforce, so hiding a control alone cannot authorize or forbid a command.
