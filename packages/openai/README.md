# @toolcog/openai

[![Version](https://img.shields.io/npm/v/@toolcog/openai)](https://www.npmjs.com/package/@toolcog/openai)
[![License](https://img.shields.io/github/license/toolcog/toolcog)](LICENSE)

`@toolcog/openai` provides a plugin for using OpenAI models with
[Toolcog][toolcog]. The plugin wraps the [`openai`][openai-node] package,
providing `Generator` and `Embedder` implementations for the
[Toolcog runtime][toolcog-runtime].

## Usage

### Model Names

The OpenAI plugin will automatically be used for known OpenAI model names,
such as "gpt-4o", or "text-embedding-3-large". To use the OpenAI plugin with
a non-standard or fine-tuned model, prefix the model name with "openai:",
e.g. "openai:my-fine-tuned-model".

### Toolcog CLI

The OpenAI plugin is loaded automatically by the `toolcog` CLI, though it
can also be explicitly enabled with the `--plugin @toolcog/openai` option.
To use OpenAI models with the Toolcog CLI, you must have a valid
`OPENAI_API_KEY` variable defined in your environment.

Specify the `--generative-model` option to use a particular language model.
Specify the `--embedding-model` option to use a particular embedding model.

```sh
npx toolcog --generative-model=gpt-4o-2024-08-06 --embedding-model=text-embedding-3-small
```

### Toolcog Runtime

To use the OpenAI plugin in a Toolcog application, include it in the `plugins`
array of your `Runtime` configuration.

```typescript
import { Runtime } from "@toolcog/runtime";

const runtime = await Runtime.create({
  embedder: {
    model: "text-embedding-3-small",
  },
  generator: {
    model: "gpt-4o-2024-08-06",
    system: Runtime.systemPrompt(),
  },
  plugins: [import("@toolcog/openai")],
});

await Runtime.run(runtime, () => {
  // Runtime operations go here.
});
```

### OpenAI Configuration

The Toolcog runtime is designed to be pluggable and model agnostic. As such,
the core runtime does not define any vendor-specific options. To support
type-safe, vendor-specific configuration, model plugins augment designated
Toolcog interfaces with supported custom properties.

To inform the TypeScript compiler about OpenAI-specific options, add
`"@toolcog/openai"` to the `types` array in your `tsconfig.json` file.

```json
{
  "compilerOptions": {
    "types": ["@toolcog/openai"]
  }
}
```

You can then safely include OpenAI-specific options anywhere that accepts
`GeneratorConfig`, `GeneratorOptions`, `EmbedderConfig`, and `EmbedderOptions`.

Here's an example of OpenAI-specific options used in a runtime configuration.

```typescript
const runtime = await Runtime.create({
  embedder: {
    // Down-sample the dimension of embedding vectors
    dimensions: 1536,
    // Override the default embedding generation batch size.
    batchSize: 100,
    // ...
  },
  generator: {
    // Specify an `OpenAI` instance or provide custom `ClientOptions`.
    openai: {
      apiKey: "...",
      organization: "...",
      project: "...",
      baseURL: "...",
      timeout: 10000,
      maxRetries: 3,
    },
    // Use legacy JSON mode instead of structured outputs.
    jsonMode: true,
    service_tier: "auto",
    stop: ["\n\n"],
    temperature: 1.0,
    // ...
  },
});
```

Here's an example of overriding OpenAI-specific options for a particular
generative function.

```typescript
/*
 * Tell a really random joke about the given subject.
 */
const tellJoke = definePrompt<(subject: string) => string>({
  // Use a low temperature to make the joke less predictable.
  temperature: 0.5,
});
```

[toolcog]: https://github.com/toolcog/toolcog#readme
[openai-node]: https://github.com/openai/openai-node#readme
[toolcog-runtime]: https://github.com/toolcog/toolcog/tree/main/packages/runtime#readme
