---
"@toolcog/util": patch
---

Properly serialize GraphQL literal input values.

Enum value literals must be wrapped by the `enumValue` function to ensure
proper serialization. Enum values are represented as strings in TypeScript,
but they must be serialized as unquoted identifiers in GraphQL arguments.
The `enumValue` function returns an object with a private symbol that
disambiguates enum value literals from string literals. Note that this
constraint only applies to literal arguments, not to spliced variables.
