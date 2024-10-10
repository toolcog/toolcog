# @toolcog/runtime

[![Version](https://img.shields.io/npm/v/@toolcog/runtime)](https://www.npmjs.com/package/@toolcog/runtime)
[![License](https://img.shields.io/github/license/toolcog/toolcog)](LICENSE)

The `@toolcog/runtime` package contains a pluggable runtime for Tool Augmented
Generation (TAG). TAG is an architecture for connecting LLMs to APIs,
enabling developers to:

- **Implicitly Use Tools:** Provide LLMs with only the tools that are most
  relevant to the current prompt.
- **Evaluate Generative Functions:** Supply structured arguments to LLMs,
  and receive structured values in return, all according to your instructions.
- **Embed Multiple Toolkits:** Incorporate off-the-shelf toolkits for popular
  APIs and services, enabling LLMs to take any action a user could take.

Most library code doesn't interact with the Toolcog runtime directly.
Libraries define LLM tools, generative functions, and semantic indexes
by invoking intrinsic functions from the [Toolcog core][toolcog-core] API.
At build time, the [Toolcog compiler][toolcog-compiler] statically analyzes
intrinsic call sites, generating descriptive schemas and semantic embeddings
that explain the code's behavior and appropriate use by AI models. The compiler
then transforms these intrinsic calls into optimized code that uses `Generator`,
`Embedder`, and `Indexer` hooks implemented by a runtime.

The Toolcog runtime, in turn, delegates integration with specific AI models
and vector indexes to plugins, such as the [`@toolcog/openai`][toolcog-openai]
plugin and the [`@toolcog/anthropic`][toolcog-anthropic] plugin.

## Implicit Context

The Toolcog runtime uses implicit context, accessed via async local variables,
to associate runtime state. There are several reasons for this approach:

- **Inversion of Control:** Library code that defines tools, generative
  functions, and semantic indexes shouldn't unduly constrain the specific
  models and environments in which it can run.
- **Simplified API:** LLM tools run in the same context as the prompts that
  triggered them, without having to pass around explicit context variables.
- **Automatic Scoping:** All Toolcog code runs in the context of an agent,
  encapsulating tools, message history, API keys, and other resources that
  tend to vary by user and use case.

## Configuring a Runtime

Here's an example of how to instantiate and configure a Toolcog runtime:

```typescript
import { Runtime } from "@toolcog/runtime";

// Instantiate a new `Runtime` from a configuration object.
const runtime = await Runtime.create({
  // Provide an array of `PluginSource`s for the runtime to load.
  plugins: [import("@toolcog/openai"), import("@toolcog/anthropic")],
  // Provide an array of `ToolkitSource`s for the runtime to load and use.
  toolkits: [import("@toolcog/github")],
  // Configure default options for embedding models.
  embedder: {
    // Specify the default embedding model to use.
    model: "text-embedding-3-small",
  },
  // Configure default options for generative models.
  generator: {
    // Specify the default generative model to use.
    model: "gpt-4o",
    // Specify the default system prompt to use.
    system: Runtime.systemPrompt(),
  },
  // Load a Toolcog inventory file from the default location
  // (`${outDir}/toolcog-inventory.yaml`).
  inventory: true,
  // Alternatively, load a bundled inventory module.
  //inventory: import("./toolcog-inventory.js"),
});

// Run a function in the async-local context of the new runtime.
await Runtime.run(runtime, async () => {
  // Runtime operations go here.
});
```

## Spawning Agents

Once you have a runtime, you can create and run agents within it:

```typescript
import { AgentContext, generate, useTool } from "@toolcog/runtime";

Runtime.run(runtime, async () => {
  // Instantiate a new `AgentContext` from a configuration object.
  const agent = AgentContext.create({
    // Configure default tools, message history, etc.
  });

  // Run a function in the async-local context of the new agent.
  AgentContext.run(agent, async () => {
    // Optionally add tools to the agent's implicit tool set.
    //useTool(currentLocation);
    //useTool(getWeather);

    // Invoke the runtime's default `Generator` directly.
    const result = await generate("What's the weather like today?", {
      // Override tools, model, system prompt, streaming behavior, etc.
    });

    console.log(result);
  });
});
```

[toolcog-core]: https://github.com/toolcog/toolcog/tree/main/packages/core#readme
[toolcog-compiler]: https://github.com/toolcog/toolcog/tree/main/packages/compiler#readme
[toolcog-openai]: https://github.com/toolcog/toolcog/tree/main/packages/openai#readme
[toolcog-anthropic]: https://github.com/toolcog/toolcog/tree/main/packages/anthropic#readme
