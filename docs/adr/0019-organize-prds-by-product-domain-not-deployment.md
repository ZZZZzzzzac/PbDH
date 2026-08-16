# Organize PRDs by Product Domain, Not Deployment

Status: accepted

ADR-0051 renames the `GM App` L1 to `GM Tabletop` and supersedes the separate Creator/GM entry-point, deployment, local-store, and document-set consequences. The product-domain-not-deployment principle remains accepted.

PbDH has one L0 Platform PRD and six L1 products: System Authoring Workflow, Player App, Creator App, GM App, Market, and Contracts & Template Platform. L2 PRDs describe independently acceptable capabilities within exactly one owning L1 unless an explicit cross-domain contract requires linked acceptance.

Deployables and code composition are a separate architecture view. Creator App and GM App deliberately use separate entry points under `apps/creator` and `apps/gm`; the modular Platform Backend supports several products without becoming an L1 product; shared packages are not Shell products.

## Consequences

- System Authoring Workflow receives an L1 PRD even though it has no first-version Author App, because System Package Author is a distinct role with its own file, validation, and preview workflow.
- Creator App and GM App receive separate L1 PRDs, entry points, local stores, cloud document kinds/payloads, and acceptance criteria even though they share the Platform Cloud Document Service and its transport protocol.
- Backend Identity, Cloud Sync, and Market modules are covered by the L0/L1 behaviours they enable plus architecture and API contracts; deployment structure does not dictate PRD hierarchy.
- Contracts & Template Platform owns cross-App schemas, compatibility rules, Template Registry behaviour, and conformance requirements, not the product workflows that consume them.
- `CONTEXT.md` defines vocabulary and relationships, ADRs define accepted durable decisions, and GitHub Issue PRDs define product scope and acceptance. A lower-level PRD cannot silently override either.
- Old repository PRDs, ADRs, implementation, and tests remain evidence. New PRDs link to that evidence but restate requirements under the new ownership model.
