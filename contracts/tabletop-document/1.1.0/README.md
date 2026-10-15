# Tabletop Document 1.1.0

Adds optional `instances[].backResourceCopy`, with the same non-recursive resource-copy structure as the front. `geometry.flipped` selects the visible side; the front and instance state remain unchanged. Images in either side must be included in `assets` and the portable archive.

Readers retain support for 1.0.0 and its `resourceCopy.media.back` image. An absent back copy does not imply a missing required field. Source `alternate-form` pointers are accepted as historical serialized back configuration, never as an instruction to walk a resource graph while flipping. A back copy cannot itself contain another back copy.
