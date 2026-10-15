# Unify Card Interaction as Reversible Front/Back Flipping

Status: accepted

PbDH does not interpret game semantics. A back is a role of an ordinary card or image, not a special resource type. The platform exposes one reversible flip operation and removes form replacement.

An instance retains its original front and an optional back copy. Flipping toggles the visible side without changing instance identity, state, indicators, position, size, rotation, or layer. Shared backs never lose the identity of each instance's front. The back's own back relation is not followed; there are exactly two sides, no chain or navigation history.

Authors configure only the front's back. Returning is an instance operation, not an automatically generated reverse resource relation. This supersedes ADR-0060's replacement command and the earlier draft of this ADR that prohibited retaining a previous front. That draft could not support several fronts sharing one back and was withdrawn before release.

Existing published artifacts remain subject to ADR-0046's read-or-migrate guarantee. This decision does not authorize silently rewriting user documents or changing published Contract Schemas in place.

The original front remains the owner of instance state; flipping does not initialize, reset, or reinterpret state using the back template. Back rendering uses the shared canonical renderer. Both sides remain available when a saved document is reopened; missing sources must not prevent returning to the retained front.

Existing `media.back` images and single `alternate-form` references are read as back configuration. Their serialized names remain compatibility details, not separate user operations. Daggerheart keeps its original 640 resources and back images; TTTRI keeps its five existing pairs. No package conversion or extra back resources are needed. The earlier conversion tooling is withdrawn.
