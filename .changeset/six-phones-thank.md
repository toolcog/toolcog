---
"@toolcog/compiler": minor
"@toolcog/util": minor
---

Generate tuple schemas.

Update JSON schema types to use newer `prefixItems` and `items` properties.

Fix schema generation for readonly arrays.

Exclude un-representable schema elements:
- Exclude properties with symbolic names from object schemas.
- Exclude function properties from object schemas.
- Exclude function variants from union types.
