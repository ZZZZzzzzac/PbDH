# Separate Creator and GM Apps

Status: accepted

PbDH will ship Creator App and GM App as separate product entry points and deployments. Creator App is the Card Workshop and owns Game Resource authoring, Creator Workspaces, Resource Package assembly, conversion, export, and Market publication actions. GM App is the GM Card Table and owns installed GM resources, Tabletop Documents, Tabletop Instances, table preparation, play-time interaction, persistence, and synchronization. There is no Creator/GM App or shared App Shell. This supersedes ADR-0018's decision to host two L1 domains in one frontend.

The two Apps share versioned Contracts, Resource Templates, Resource Renderer, applicable resource conversion and tabletop packages, PbDH Account identity, Cloud Sync infrastructure, Managed Media Assets, and Platform Backend APIs. Shared code does not create shared mutable application state or data ownership. Creator resources reach GM App through explicit Resource Package snapshot transfer or another contract-governed publication/import action, never through one frontend's browser-local store.

The first composition roots are `apps/creator` and `apps/gm`. They release independently, own separate local stores and cloud document repositories, and remain independently usable when the other App is unavailable or unfinished. Account-wide session and media-quota policies still span both Apps; unified identity does not merge their data.
