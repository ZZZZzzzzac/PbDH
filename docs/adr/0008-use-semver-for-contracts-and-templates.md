# Use SemVer for Contracts and Templates

Status: accepted

Every Platform Contract Family version and Resource Template version will use Semantic Versioning in `MAJOR.MINOR.PATCH` form. Exchanged and persisted artifacts record the exact applicable version, while Apps and System Packages may declare supported SemVer ranges where their contracts allow it.

`MAJOR` identifies an incompatible stored shape, protocol, or meaning and requires an explicit migration or rejection path. `MINOR` adds backward-compatible capability that an older conforming reader can safely ignore. `PATCH` fixes validation, rendering, documentation, or implementation behaviour without changing the stored shape or required interpretation.

## Consequences

- Producers write an exact version, not a range; consumers publish or encode their supported ranges.
- Version-range satisfaction only selects a compatible handler. It never transforms data or proves semantic validity.
- Crossing an unsupported `MAJOR` requires an explicit, tested migration chain; no loader guesses from field shape or silently relabels the version.
- Long-lived document Contracts retain either a compatible Reader or an explicit migration path before an old `MAJOR` can be retired. Backend API versions follow their separate protocol deprecation policy.
- Unknown or unsupported versions follow the failure policy of their Contract Family. Resource fallback into Other Resources remains distinct from accepting that resource into a System Package.
- A `MINOR` addition must remain ignorable by older readers within the same `MAJOR`; otherwise it is a `MAJOR` change.
- A `PATCH` release cannot add required persisted fields or change field meaning.
- Prerelease versions may be used in development fixtures but are not accepted in public Market artifacts unless a later publication policy explicitly permits them.
