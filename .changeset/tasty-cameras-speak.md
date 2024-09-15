---
"@toolcog/util": patch
---

Implement JSON schema validation, matching, and subtyping

The `validate` function checks if a given value conforms to a schema object.
The `isSubschema` function checks if one subschema represents a subtype of
another schema. The `matchSchema` function returns the most specific subschema
that matches a given value. When multiple subschemas match.

The `formatJson` function now uses `matchSchema` internally to splice in
descriptive comments for a polymorphic value's most specific subtype.
