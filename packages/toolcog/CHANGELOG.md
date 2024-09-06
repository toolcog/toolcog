# toolcog

## 0.0.2

### Patch Changes

- [#3](https://github.com/toolcog/toolcog/pull/3) [`f57080e`](https://github.com/toolcog/toolcog/commit/f57080e99a41fc8484ea46bd3c49a73cad01c996) Thanks [@c9r](https://github.com/c9r)! - Add current `query` to `AgentContext`; and use as default `Index` query param.
  Modify `ToolSource`, `resolveTool`, and `resolveTools` to support functions
  that return arrays of tools. Taken together, this enables tool indexes to be
  directly used as tool sources, with the current LLM prompt automatically used
  as the tool query.
- Updated dependencies [[`f57080e`](https://github.com/toolcog/toolcog/commit/f57080e99a41fc8484ea46bd3c49a73cad01c996)]:
  - @toolcog/runtime@0.0.2
  - @toolcog/node@0.0.2
  - @toolcog/compiler@0.0.2
