# @toolcog/compiler

## 0.0.3

### Patch Changes

- [#4](https://github.com/toolcog/toolcog/pull/4) [`ccd92e3`](https://github.com/toolcog/toolcog/commit/ccd92e3b007776fa9334740533d6c668084cc7cf) Thanks [@c9r](https://github.com/c9r)! - Fix source node ID generation when transforming via bundler

  `@id` doc tags can now be used to override automatic source node ID generation.
  `@noid` doc tags can also now be used to prevent enclosing named blocks from
  being included in generated source node IDs.

  The parameter type of the `defineIndex` intrinsic now properly reflects the
  fact that it can be called with an array of pre-generated idioms.

- [#8](https://github.com/toolcog/toolcog/pull/8) [`71d394c`](https://github.com/toolcog/toolcog/commit/71d394cdcf2541882ce87c259831a6e0ab84df62) Thanks [@c9r](https://github.com/c9r)! - Generate additional schema metadata

  Set "title" fields in generated schemas to type names, when available.
  Set "default" fields in generated schemas to the value of `@default` doc tags.
  Set const schema variant descriptions from `@constant` doc tags of parent type.

- Updated dependencies [[`ccd92e3`](https://github.com/toolcog/toolcog/commit/ccd92e3b007776fa9334740533d6c668084cc7cf), [`3546fde`](https://github.com/toolcog/toolcog/commit/3546fdeb47ba1561a0d135bd67096c5c5d9ea945), [`8aef77c`](https://github.com/toolcog/toolcog/commit/8aef77c6a830367fbc41170ef7e0700d32087d82)]:
  - @toolcog/runtime@0.0.3
  - @toolcog/core@0.0.3
  - @toolcog/util@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies [[`f57080e`](https://github.com/toolcog/toolcog/commit/f57080e99a41fc8484ea46bd3c49a73cad01c996)]:
  - @toolcog/runtime@0.0.2
  - @toolcog/core@0.0.2
