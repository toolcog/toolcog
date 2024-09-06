---
"@toolcog/runtime": patch
"@toolcog/core": patch
"toolcog": patch
---

Add current `query` to `AgentContext`; and use as default `Index` query param.
Modify `ToolSource`, `resolveTool`, and `resolveTools` to support functions
that return arrays of tools. Taken together, this enables tool indexes to be
directly used as tool sources, with the current LLM prompt automatically used
as the tool query.
