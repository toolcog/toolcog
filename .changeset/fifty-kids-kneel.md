---
"@toolcog/compiler": patch
"@toolcog/runtime": patch
"@toolcog/core": patch
---

Fix source node ID generation when transforming via bundler

`@id` doc tags can now be used to override automatic source node ID generation.
`@noid` doc tags can also now be used to prevent enclosing named blocks from
being included in generated source node IDs.

The parameter type of the `defineIndex` intrinsic now properly reflects the
fact that it can be called with an array of pre-generated idioms.
