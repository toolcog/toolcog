# @toolcog/util

## 0.0.3

### Patch Changes

- [#7](https://github.com/toolcog/toolcog/pull/7) [`3546fde`](https://github.com/toolcog/toolcog/commit/3546fdeb47ba1561a0d135bd67096c5c5d9ea945) Thanks [@c9r](https://github.com/c9r)! - Implement JSON schema validation, matching, and subtyping

  The `validate` function checks if a given value conforms to a schema object.
  The `isSubschema` function checks if one subschema represents a subtype of
  another schema. The `matchSchema` function returns the most specific subschema
  that matches a given value. When multiple subschemas match.

  The `formatJson` function now uses `matchSchema` internally to splice in
  descriptive comments for a polymorphic value's most specific subtype.

- [#5](https://github.com/toolcog/toolcog/pull/5) [`8aef77c`](https://github.com/toolcog/toolcog/commit/8aef77c6a830367fbc41170ef7e0700d32087d82) Thanks [@c9r](https://github.com/c9r)! - Render stylized markdown output in the REPL
