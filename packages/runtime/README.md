# @toolcog/runtime

[![Version](https://img.shields.io/npm/v/@toolcog/runtime)](https://www.npmjs.com/package/@toolcog/runtime)
[![License](https://img.shields.io/github/license/toolcog/toolcog)](LICENSE)

`@toolcog/runtime` is an AI runtime for Tool Augmented Generation (TAG).
TAG is an architecture for connecting LLMs to APIs, enabling developers to:

- **Implicitly Use Tools:** Provide LLMs with only the tools that are most
  relevant to the current prompt.
- **Evaluate Generative Functions:** Supply structured arguments to LLMs,
  and receive structured values in return, all according to your instructions.
- **Embed Multiple Toolkits:** Incorporate off-the-shelf toolkits for popular
  APIs and services, enabling LLMs to take any action a user could take.

Application code primarily calls the intrinsic functions defined in
`@toolcog/core`, such as `defineTool`, `definePrompt`, and `defineIndex`.
The `@toolcog/compiler` transforms these intrinsic calls into code that
invokes the runtime hooks defined in `@toolcog/runtime`.

The Toolcog runtime is pluggable. Most runtime behavior is implemented by
plugins, such as the `@toolcog/anthropic` plugin and the `@toolcog/openai`
plugin.

## Implicit Context

The Toolcog runtime uses implicit context accessed through async local
variables. There are several reasons for this approach:

- **Inversion of Control:** Library code that defines tools, generative
  functions, and semantic indexes doesn't need to know about the specific
  models or environments in which it eventually runs.
- **Simplified API:** LLM tools run in the same context as the prompt that
  triggered them, without having to pass around explicit context variables.
- **Automatic Scoping:** All Toolcog code runs in the context of an agent,
  encapsulating tools, message history, API keys, and other resources that
  vary by user and use case.

## Instantiating a Runtime

Here's an example of how to instantiate and configure a Toolcog runtime:

```typescript
import { Runtime } from "@toolcog/runtime";

const runtime = await Runtime.create({
  embedder: {
    model: "text-embedding-3-small",
  },
  generator: {
    system: Runtime.systemPrompt(),
  },
  plugins: [import("@toolcog/openai"), import("@toolcog/anthropic")],
  toolkits: [import("@toolcog/github")],
});

await Runtime.run(runtime, () => {
  // Runtime operations go here.
});
```

## Spawning Agents

Once you have a runtime, you can create and run agents within it:

```typescript
import { AgentContext, generate, useTool } from "@toolcog/runtime";

Runtime.run(runtime, async () => {
  const agent = AgentContext.create({
    // Configure default tools, message history, etc.
  });

  AgentContext.run(agent, async () => {
    // Add tools to the agent's implicit tool set.
    //useTool(currentLocation);
    //useTool(getWeather);

    const result = await generate("What's the weather like today?", {
      // Override tools, model, system prompt, streaming behavior, etc.
    });

    console.log(result);
  });
});
```

## Related Packages

- [@toolcog/core](https://github.com/toolcog/toolcog/tree/main/packages/core#readme): Core API for Tool Augmented Generation (TAG) applications.
- [@toolcog/compiler](https://github.com/toolcog/toolcog/tree/main/packages/compiler#readme): Compiler for transforming Toolcog intrinsics.
