# PbDH Cards Creator Workspace Migration

Source repository: `PbDH_Cards`

Source commit: `0745f4e45d6bc1cb06bc7f5d7b005757546c5cbe`

Selected sources:

- `frontend/src/workspace/workspaceModel.ts`: recursive folders, mixed node ordering, temporary and pinned tabs, tab closing, deletion, and node movement.
- `frontend/src/components/WorkspaceTree.tsx`: recursive tree rendering, folder collapse, drag-and-drop placement, and node context menus.
- `frontend/src/workspace/useAnonymousWorkspace.ts`: resource activation, pinning, closing, folder selection, deletion, and movement behavior.
- `frontend/src/pages/WorkshopPage.tsx`: editor tab rendering and close controls.

Migration boundary:

- `CardDocument` is adapted to a Resource Package `Game Resource`; folders and ordering remain Creator Workspace state.
- Moving a resource updates its Resource Package `path`; empty directories are synchronized with the package document.
- Resource Template icons and the reviewed Creator visual language replace the legacy card-type presentation.
- Existing Creator-to-GM placement and Resource Package import/export flows remain host-owned integrations.
- Resource Package export stays Contract-authoritative; draft content, tree layout, collapse state, and open tabs persist through the shared `creator-workspace` local document store.
- An empty newly created workspace is a valid Creator draft but cannot pass Resource Package export or publication validation until it contains a resource.
- The host aggregates tabs across every open Resource Package using package ID plus resource ID as identity; one temporary preview tab is shared across the window.
- Closing a Resource Package deletes its cached Creator Workspace after explicit confirmation; importing the same package ID later creates a new local workspace from that snapshot.
- Resource duplication copies the resource definition beside its source with a new package-local ID and path while retaining shared media references.
