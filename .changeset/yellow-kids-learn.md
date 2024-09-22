---
"@toolcog/util": patch
---

Add strongly typed GraphQL query generator library for use by toolkits.

Model GraphQL queries as composable JSON objects, with full support for
selection sets, field arguments, field aliases, inline fragments, variables,
directives, type references, and strict nullability modeling.

Statically infers all variables referenced by a query model, ensuring that
all required arguments are provided, without each model having to redundantly
list its own encapsulated parameters.

Generates well-formed GraphQL queries from query object models.
