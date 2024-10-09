# @toolcog/anthropic

[![Version](https://img.shields.io/npm/v/@toolcog/anthropic)](https://www.npmjs.com/package/@toolcog/anthropic)
[![License](https://img.shields.io/github/license/toolcog/toolcog)](LICENSE)

`@toolcog/anthropic` provides a plugin for using Anthropic models with
[Toolcog][toolcog]. The plugin wraps the [@anthropic-ai/sdk][anthropic-sdk]
package, providing a `Generator` implementation for the
[Toolcog runtime][toolcog-runtime].

## Usage

### Model Names

The Anthropic plugin will automatically be used for known Anthropic model names,
such as "claude-3-5-sonnet-20240620". To use the Anthropic plugin with a
non-standard or fine-tuned model, prefix the model name with "anthropic:",
e.g. "anthropic:my-fine-tuned-model".

### Toolcog CLI

The Anthropic plugin is loaded automatically by the `toolcog` CLI, though it
can also be explicitly enabled with the `--plugin @toolcog/anthropic` option.
To use Anthropic models with the Toolcog CLI, you must have a valid
`ANTHROPIC_API_KEY` variable defined in your environment.

Specify the `--generative-model` option to use a particular language model.

```sh
npx toolcog --generative-model=claude-3-5-sonnet-20240620
```

### Toolcog Runtime

To use the Anthropic plugin in a Toolcog application, include it in the
`plugins` array of your `Runtime` configuration. Note that, in most cases,
you will also need to include a separate plugin that provides an embedding
model, since Anthropic does not provide its own embedding models at this time.

```typescript
import { Runtime } from "@toolcog/runtime";

const runtime = await Runtime.create({
  embedder: {
    model: "text-embedding-3-small",
  },
  generator: {
    model: "claude-3-5-sonnet-20240620",
    system: Runtime.systemPrompt(),
  },
  plugins: [import("@toolcog/anthropic"), import("@toolcog/openai")],
});

await Runtime.run(runtime, () => {
  // Runtime operations go here.
});
```

### Anthropic Configuration

The Toolcog runtime is designed to be pluggable and model agnostic. As such,
the core runtime does not define any vendor-specific options. To support
type-safe, vendor-specific configuration, model plugins augment designated
Toolcog interfaces with supported custom properties.

To inform the TypeScript compiler about Anthropic-specific options, add
`"@toolcog/anthropic"` to the `types` array in your `tsconfig.json` file.

```json
{
  "compilerOptions": {
    "types": ["@toolcog/anthropic"]
  }
}
```

You can then safely include Anthropic-specific options anywhere that accepts
`GeneratorConfig`, `GeneratorOptions`, `EmbedderConfig`, and `EmbedderOptions`.

Here's an example of Anthropic-specific options used in a runtime configuration.

```typescript
const runtime = await Runtime.create({
  generator: {
    // Specify an `Anthropic` instance or provide custom `ClientOptions`.
    anthropic: {
      apiKey: "...",
      authToken: "...",
      baseURL: "...",
      timeout: 10000,
      maxRetries: 3,
    },
    max_tokens: 4096,
    stop_sequences: ["\n\n"],
    temperature: 1.0,
    // ...
  },
});
```

Here's an example of overriding Anthropic-specific options for a particular
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
[anthropic-sdk]: https://github.com/anthropics/anthropic-sdk-typescript#readme
[toolcog-runtime]: https://github.com/toolcog/toolcog/tree/main/packages/runtime#readme
