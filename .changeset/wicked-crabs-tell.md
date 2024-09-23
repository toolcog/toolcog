---
"@toolcog/compiler": patch
---

Rename @constant doc tag to @value.

Used to document the meaning of specific values a type can take on.
The text of @value doc tags gets inserted into generated "const" schemas
for the corresponding literal type variant. Despite their use in "const"
schemas, @value reads better than @constant in documentation comments.
