---
"@toolcog/compiler": patch
"@toolcog/runtime": patch
"@toolcog/anthropic": patch
"@toolcog/core": patch
"@toolcog/repl": patch
"@toolcog/util": patch
"@toolcog/openai": patch
"@toolcog/node": patch
"toolcog": patch
---

Move to bundle-less build system.

Use `tsc` to transpile typescript to esm and generate dts files. Use `swc`
to transpile typescript to cjs. Add "source" entries to all module exports
pointing to the original typescript sources.
