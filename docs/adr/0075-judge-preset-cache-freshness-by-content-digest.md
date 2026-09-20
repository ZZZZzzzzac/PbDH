# Judge Bundled Preset Cache Freshness by Content Digest

Status: accepted

A bundled preset System Package ships two independent payloads: the runtime files listed in `.pbdh-runtime-files.json`, and the embedded resource archive (`resources/*.pbres`) indexed in the preset metadata. Each payload now carries its own content digest, and Player uses those digests instead of the release version to decide whether a cached package is still current.

`metadataDigest` is computed by `scripts/sync-bundled-system-package-metadata.ts` over the sorted runtime file list (per-file content hash folded into one `sha256:`), so it identifies the content of that preset without any network request. The embedded archive keeps using `embeddedResourceIndex[].snapshotDigest`, which `installMissingEmbeddedResourcePackages` already compares against the installed record.

At startup Player resolves the target package first (deep link → last used system package → default), routes the resource library with that target, activates the cached package, and then calls `ensurePresetSystemPackage`. When the cached package is already the preset's current content, Player keeps it and only re-checks the embedded resource archive; the whole-package download happens only when the digest differs, the cache belongs to another system, or no digest is available. A startup that finds changed preset content uses the copy `initialize` already downloaded (confirming that pending replacement instead of fetching the same runtime files a second time).

## Consequences

- Refreshing the Player page no longer walks the loading bar through a full preset download. The bar appears for first loads, real system switches, and content changes.
- The release version stops being a freshness signal when both sides have a digest. A deployment that ships unchanged preset content reuses the cache, while repacking a preset during development changes `metadataDigest` and invalidates the cache on the next load.
- Presets without a digest keep the previous behavior: they are re-downloaded, because an unknown digest is never treated as current. The same applies to cache records written before this change, which self-heal on the next load.
- Cache freshness is a preset-sourced record comparison: the recorded `metadataDigest` must match the digest of the currently shipped preset JSON, so an imported `.pbsys` or author-preview cache is never mistaken for a preset cache.
- Entry URLs no longer pin `daggerheart-core`. The platform root rewrites to the Player page without a system segment, so entering at the root loads the last used system package instead of loading 匕首之心 first and switching afterwards. A first visit still lands on 匕首之心 through `defaultPlayerSystemPackage`.
- The address bar always names the active preset. The Player reports the resolved package's directory while its surface is visible, and the platform replaces `/player` with `/player/<directory>`; switching packages in the page (system selector, opening another system's character save, importing one) updates it too. Deep links therefore pin a package only until the user switches, and a refresh cannot fall back to the previous one. Reporting is skipped when the Player surface is hidden, because all three surfaces stay mounted and boot while hidden.
- Loading is bounded by the payload digests, not by the release cadence: a system package whose runtime files changed but whose archive did not only refetches the runtime files, and vice versa.
- `metadataDigest` identifies content, not bytes: the digest strips `\r` from `\r\n` before hashing each runtime file. CRLF in a Windows working tree and the LF files git and CI check out are the same preset, so the digest must not depend on the checkout platform — otherwise a locally synced digest fails `check:builtin-system-packages` on CI and silently expires every user's cache.
