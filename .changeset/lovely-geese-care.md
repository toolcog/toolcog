---
"@toolcog/runtime": patch
---

Add agent-scoped toolkit configuration location.

Toolkits can augment the `AgentConfig` interface, and access
the current agent's config object by calling `currentConfig()`.
