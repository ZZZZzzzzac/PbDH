# Deploy the First Backend as a Modular Monolith

Status: accepted

PbDH will deploy its first Platform Backend as one modular monolith containing Identity, Cloud Sync, and Market modules. The modules share one process and may share infrastructure, but each owns its application interface, authorization rules, repositories, and tables. A module cannot read or mutate another module's records through its repository implementation.

The current product has one development team, one account boundary, and no demonstrated scaling or isolation requirement that offsets the operational cost of separately deployed services. In-process module calls keep deployment, local development, transactions within a domain, and diagnosis simple without abandoning boundaries needed for later extraction.

## Consequences

- Player App, Creator App, GM App, and the public Market frontend consume explicit Platform Backend APIs; they do not access storage directly.
- Cross-module work is coordinated through application interfaces or explicit events, never cross-module table access.
- Shared infrastructure code may provide authentication middleware, database connections, logging, and background-job execution, but cannot own domain policy.
- A failure of the deployed backend can make cloud and Market features unavailable, while Player App, Creator App, and GM App must retain their documented offline capabilities.
- A module becomes a separate deployable only after measured scaling, security, availability, or release-independence needs justify the operational cost; extraction requires a new ADR.
- This decision fixes the deployment shape, not the web framework, database product, or hosting provider.
