# @toolcog/core

## 0.0.3

### Patch Changes

- [#4](https://github.com/toolcog/toolcog/pull/4) [`ccd92e3`](https://github.com/toolcog/toolcog/commit/ccd92e3b007776fa9334740533d6c668084cc7cf) Thanks [@c9r](https://github.com/c9r)! - Fix source node ID generation when transforming via bundler

  `@id` doc tags can now be used to override automatic source node ID generation.
  `@noid` doc tags can also now be used to prevent enclosing named blocks from
  being included in generated source node IDs.

  The parameter type of the `defineIndex` intrinsic now properly reflects the
  fact that it can be called with an array of pre-generated idioms.

- Updated dependencies [[`3546fde`](https://github.com/toolcog/toolcog/commit/3546fdeb47ba1561a0d135bd67096c5c5d9ea945), [`8aef77c`](https://github.com/toolcog/toolcog/commit/8aef77c6a830367fbc41170ef7e0700d32087d82)]:
  - @toolcog/util@0.0.3

## 0.0.2

### Patch Changes

- [#3](https://github.com/toolcog/toolcog/pull/3) [`f57080e`](https://github.com/toolcog/toolcog/commit/f57080e99a41fc8484ea46bd3c49a73cad01c996) Thanks [@c9r](https://github.com/c9r)! - Add current `query` to `AgentContext`; and use as default `Index` query param.
  Modify `ToolSource`, `resolveTool`, and `resolveTools` to support functions
  that return arrays of tools. Taken together, this enables tool indexes to be
  directly used as tool sources, with the current LLM prompt automatically used
  as the tool query.
