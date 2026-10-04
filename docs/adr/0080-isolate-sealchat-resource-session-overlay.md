# Isolate SealChat Resources in an Optional Player Session

Status: experimental, dedicated `codex/sealchat-iframe-sync` worktree only.

The opt-in `sealchat=1` iframe mode reads the current user's active Daggerheart Dice card through the host-provided Channel Embed SDK. The user explicitly associates the open PbDH character with that active card for the lifetime of this view. The running resources, three gold denominations, six traits, evasion, armor score (mapped to the Dice armor maximum), and both damage thresholds receive a controlled display override. Other System Packages, modules and standalone Player behavior retain their existing implementation.

Dice owns the synchronized numbers. Their read snapshots, association and connection state remain in memory; they never enter Character Data, Character Save, IndexedDB or cloud documents. The integration creates no schema, migration, shared package, second character repository or background sync service. Weapon/equipment and other static edits still follow Player's existing Repository workflow. Synchronized numeric edits stay in this session and commit only the named Dice field. Exported `.pbcha` and text exports retain the PbDH save values, not the session override; using a whole-card export to replace Dice during a session can overwrite running-game balances.

Balance and maximum stepper changes send relative `.st` commands through `messages.send`; an explicit numeric edit sends `.st field=value` for that whitelisted field. Read/association/refresh never writes or initializes Dice attributes. Missing, invalid or out-of-range current/max values display as unknown and block that resource. Right-click or touch long-press on the four resource steppers changes that resource maximum. A decrease below its current balance is rejected rather than changing two fields. Armor score and armor-slot maximum read/write the same Dice attribute. Gold retains PbDH's existing 9/9/unbounded stepper limits without converting denominations; externally larger balances display accurately and can decrease. Read failures, permissions changes, disconnects and observed character/context switches revoke the association. A timed-out send is uncertain and is never replayed automatically.

The upstream SDK is loaded from the current SealChat instance, with an explicit origin; it is not bundled or copied. The deployment's single external `<iframe src>` iForm embeds PbDH directly so SealChat can recognize its `event.source`. It avoids the strict native character-sheet sandbox and nested iframe handshake mismatch. Minimal capabilities are `context.read`, `characterCard.read`, `messages.send`; no storage, attachment, attribute-write, credentials or raw WebSocket permissions are used.

## Limits and validation

- Official current-card data exposes name/type/attrs, not a stable Dice card ID. This experimental association checks PbDH ID plus SealChat channel/user/identity/name/type. It cannot detect an unobserved A→B→A switch or make read-to-send atomic; no strict concurrency, exactly-once execution or cross-device protection is claimed.
- Messages use the normal chat route and leave visible `.st` messages. Message acknowledgement does not prove Dice completion. Manual refresh, immediate read after request and a 10-second poll read the current result; there is no generic attribute push subscription.
- Closing/hiding the Player stops the session. Standalone PbDH and unopened pages do not receive background synchronization.
- Host policy configuration and isolated unmodified SealChat/Dice acceptance remain necessary before publishing. The preview uses the actual read-only SDK with a protocol fixture; it is not an actual host or production acceptance.

The parallel Seal integration worktree owns iForm setup artifacts and a local protocol preview. This experiment leaves the main workspaces' uncommitted native-sheet/export development unchanged.

## Dice assistant

The six trait modules and primary/secondary weapon summaries have separate dice buttons only in the opted-in session. Value/label clicks retain their editing behavior. System Package skin/layout files and standalone behavior remain unchanged. The scoped compact modal reads Dice traits (including explicit zero) and experiences, with action/reaction, advantage/disadvantage, modifier and difficulty controls. Reason/manual formula controls are collapsed by default. Experience requests carry the sealpack content revision; Dice validates and settles their hope cost.

Weapon damage reads the current PbDH summary (name/trait/range/damage/load separated by full-width or ASCII pipes) and proficiency. The base expression is proficiency dice plus the weapon fixed value. The exported DamageAdjustment interface explicitly composes same-die count deltas, flat modifiers and additional dice terms; the modal exposes all three. It does not infer natural-language equipment effects. Dispatch re-reads the active Dice card and checks the weapon/proficiency snapshot before sending the official .r command. A changed snapshot cancels the old request and asks to reopen the helper.

All operations share association, permission, connection and busy guards. Draft edits carry the association token, so a draft from an earlier association cannot update a newly associated card. There is no optimistic hope deduction or automatic retry after an uncertain send. Local exports still contain saved PbDH values, not the session overlay.

The official iForm's relative container accepts an absolutely positioned direct iframe with `inset:0; width:100%; height:100%`. The setup artifacts choose 840 × 790 as the default floating window; dragging its edges changes the iframe viewport. This activates PbDH's existing 1080px narrow layout, placing the card table below the A4 sheet without changing its layout CSS. Existing saved floating-window sizes may require resizing or reopening the window.
