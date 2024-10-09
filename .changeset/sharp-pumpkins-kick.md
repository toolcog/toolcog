---
"@toolcog/compiler": minor
"@toolcog/runtime": minor
"@toolcog/node": minor
"@toolcog/repl": minor
---

Support more flexible toolkit module definitions.

Default exports from toolkit modules can now be object literals, in addition
to functions. Toolkit functions can now return an immediate object, in addition
to a promise. And a toolkit's `tools` property can now be an immediate array of
tools, a function that returns an array of tools, or a function that returns a
promised array of tools.
