# Use Supabase for Auth Only and Self-host Platform Data

Status: accepted

PbDH will use Supabase Auth as its first external identity provider, but it will not use Supabase Database or Supabase Storage for Platform data. Clients authenticate with Supabase, then present the resulting identity token to the self-hosted Platform Backend. Creator Workspaces, GM tabletop documents, Character Saves, Market records, and media assets are stored and served by infrastructure controlled by that Backend.

This preserves the deployed Cards boundary and keeps document capacity and image traffic outside the limits of the current Supabase free plan. Supabase identity is an external dependency of authenticated operations, not the owner of the PbDH Account domain or user content. Replacing the identity provider must not require migrating game documents or media bytes.

Images are normalized once from a source image plus explicit crop and sizing parameters into WebP. The normalized bytes are content-addressed by a cryptographic hash and stored once by the Platform Backend. Cloud documents and Game Resources keep an Asset ID and manifest metadata instead of embedding Base64 data or making per-resource copies. Reusing an asset does not upload or store its bytes again. The original source image is not part of the cloud document.

## Consequences

- Supabase traffic is limited to identity operations and token infrastructure; PbDH media upload and download never use Supabase Storage.
- Apps access documents and assets through Platform Backend APIs, never through the Backend's database or filesystem directly.
- Structured documents and binary assets remain separate persistence concerns. The first implementation may reuse the Cards database and media-directory behavior without making SQLite or a local filesystem part of the public contract.
- An identical normalized WebP can share one physical blob through its content hash; references remain explicit so later garbage collection can distinguish live and unreferenced assets.
- Upload retry must be idempotent: receiving bytes already known by hash returns the existing Asset ID rather than creating another object.
- Asset retention and garbage-collection timing remain separate policy decisions. Visibility follows ADR-0030; content addressing alone does not make a private asset public.
