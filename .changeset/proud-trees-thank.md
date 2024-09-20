---
"@toolcog/runtime": patch
---

Improve temporal tool selection accuracy with query hysteresis.

Use an exponentially decayed weighted average of the n most recent
query embeddings as the tool selection search vector. This enables
the semantic content of previous queries to influence tool selection
for the current query, with more recent queries given more weight
than older queries.
