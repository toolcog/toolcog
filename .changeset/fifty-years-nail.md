---
"@toolcog/compiler": patch
---

Generate additional schema metadata

Set "title" fields in generated schemas to type names, when available.
Set "default" fields in generated schemas to the value of `@default` doc tags.
Set const schema variant descriptions from `@constant` doc tags of parent type.
