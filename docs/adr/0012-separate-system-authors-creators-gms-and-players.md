# Separate System Authors, Creators, GMs, and Players

Status: accepted

PbDH distinguishes four game-ecosystem roles. A System Package Author designs a TRPG rule system and owns its System Package. A Creator adds Game Resources without changing that system. A Game Master selects rules and resources and runs games. A Player participates through characters and the player tabletop. Their content scope forms the chain System Package Author → GM/Creator → Player, while expected usage frequency runs in the opposite direction.

Platform Administrator is a separate governance role that registers trusted Resource Templates. It is not the top of the game-content chain: platform Template authority does not grant ownership of an Author's System Package, and System Package ownership does not grant Template publication authority.

## Consequences

- Creator App serves the Creator role; GM App serves the GM role. Shared Resource Templates and packages do not merge their workflows or data ownership.
- Neither first-version App gains System Package authoring merely because a GM or Creator may also be an Author in real life.
- Player App optimizes its default navigation and startup for the highest-frequency Player workflows; System Package author controls cannot appear as ordinary Player features.
- System Package authoring is a separate low-frequency workflow whose tooling and preview host require a further decision.
- Role association on one PbDH Account may be contextual and overlapping. It must not be implemented as one global privilege ladder where an Author can automatically mutate Creator, GM, or Player data.
- Authorization follows artifact ownership and action, not the informal role hierarchy alone.
