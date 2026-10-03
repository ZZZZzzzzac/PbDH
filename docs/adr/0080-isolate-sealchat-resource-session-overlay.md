# Isolate SealChat Resources in an Optional Player Session

Status: experimental, dedicated `codex/sealchat-iframe-sync` worktree only.

The opt-in `sealchat=1` iframe mode reads the current user's active Daggerheart Dice card through the host-provided Channel Embed SDK. The user explicitly associates the open PbDH character with that active card for the lifetime of this view. Only `hp`, `stress`, `armor-slots` and `hope` receive a controlled display override. Other System Packages, modules and standalone Player behavior retain their existing implementation.

Dice owns these four running-game balances. Their read snapshots, association and connection state remain in memory; they never enter Character Data, Character Save, IndexedDB or cloud documents. The integration creates no schema, migration, shared package, second character repository or background sync service. Static edits still follow Player's existing Repository workflow. Exported `.pbcha` and text exports retain the PbDH save values, not the session override; using a whole-card export to replace Dice during a session can overwrite running-game balances.

Changes send only relative `.st` commands through `messages.send`. Read/association/refresh never writes or initializes Dice attributes. Missing, invalid or out-of-range current/max values display as unknown and block that resource. Maxima are read-only during this mode; edit/import them through the existing explicit workflows before associating. Read failures, permissions changes, disconnects and observed character/context switches revoke the association. A timed-out send is uncertain and is never replayed automatically.

The upstream SDK is loaded from the current SealChat instance, with an explicit origin; it is not bundled or copied. The deployment's single external `<iframe src>` iForm embeds PbDH directly so SealChat can recognize its `event.source`. It avoids the strict native character-sheet sandbox and nested iframe handshake mismatch. Minimal capabilities are `context.read`, `characterCard.read`, `messages.send`; no storage, attachment, attribute-write, credentials or raw WebSocket permissions are used.

## Limits and validation

- Official current-card data exposes name/type/attrs, not a stable Dice card ID. This experimental association checks PbDH ID plus SealChat channel/user/identity/name/type. It cannot detect an unobserved A→B→A switch or make read-to-send atomic; no strict concurrency, exactly-once execution or cross-device protection is claimed.
- Messages use the normal chat route and leave visible `.st` messages. Message acknowledgement does not prove Dice completion. Manual refresh, immediate read after request and a 10-second poll read the current result; there is no generic attribute push subscription.
- Closing/hiding the Player stops the session. Standalone PbDH and unopened pages do not receive background synchronization.
- Host policy configuration and isolated unmodified SealChat/Dice acceptance remain necessary before publishing. The preview uses the actual read-only SDK with a protocol fixture; it is not an actual host or production acceptance.

The parallel Seal integration worktree owns iForm setup artifacts and a local protocol preview. This experiment leaves the main workspaces' uncommitted native-sheet/export development unchanged.

## Dice assistant (2026-10-04 experiment)

Both worktrees have merged their latest committed main lines (Seal 8d6526c / sealpack 0.4.7; PbDH f6261fa). The assistant listens to the six existing Daggerheart trait modules' value/label clicks, with a `display: contents` event boundary. Package skin/layout files stay unchanged; pausing the association restores normal attribute editing, and standalone behavior remains unchanged. Only the new modal has scoped presentation rules. It uses Dice trait values (including explicit zero), not saved PbDH modifiers, and shows the Dice experience list and hope cost.

The modal supports action/reaction, normal/advantage/disadvantage, extra modifier, difficulty, reason, and a manually editable single-line `.dd`/`.ddr` command. Experience selections include the sealpack's content revision; changes use the controls to generate the command. Dispatch re-reads the active card, revision and hope, preserves the same association/connection guards, and never optimistically deducts hope. The plugin validates selected experience costs and settles the result. An uncertain send is not retried. Fresh static data still enters Dice through an explicit PbDH export, never through the session overlay.

The official iForm's relative container accepts an absolutely positioned direct iframe with `inset:0; width:100%; height:100%`. The setup artifacts choose 840 × 790 as the default floating window; dragging its edges changes the iframe viewport. This activates PbDH's existing 1080px narrow layout, placing the card table below the A4 sheet without changing its layout CSS. Existing saved floating-window sizes may require resizing or reopening the window.
