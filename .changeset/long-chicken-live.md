---
"@toolcog/util": patch
---

Don't discard schemas when narrowing against non-conformant values.

Rename `isSubschema` to `isSubtype`. Rename `matchSchema` to `narrowSchema`.
