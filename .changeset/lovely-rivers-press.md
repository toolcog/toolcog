---
"@toolcog/runtime": minor
"@toolcog/anthropic": minor
"@toolcog/core": minor
"@toolcog/util": minor
"@toolcog/openai": minor
---

Improve tool selection accuracy with prompt splitting.

Split prompts into sentences, by default, and generate a separate embedding
for each sentence. The default strategy will likely evolve over time.
The split function can be configured with the `splitPrompt` property of
`AgentContextOptions`.

Tool selection hysteresis has been reworked to retain a rolling window of
recent prompt embeddings. Tool selection now finds the most similar tools
to any prompt embedding in the window, with a penalty factor applied to the
computed distance of older prompts. The `historyPenalty` property of
`IndexOptions` can be used to override the penalty rate for an index.
The `promptHysteresis` property of `AgentContextOptions` can be used to
override the length of the prompt history window for a given agent.

Add a small `nlp` utility library with the sentence splitting implementation.
