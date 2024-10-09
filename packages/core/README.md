# @toolcog/core

[![Version](https://img.shields.io/npm/v/@toolcog/core)](https://www.npmjs.com/package/@toolcog/core)
[![License](https://img.shields.io/github/license/toolcog/toolcog)](LICENSE)

`@toolcog/core` is the Toolcog API for Tool Augmented Generation (TAG). TAG is
an architecture for connecting LLMs to APIs, enabling developers to:

- **Generate LLM Tools:** Make TypeScript functions reliably callable by LLMs
  with minimal boilerplate and prompt engineering.
- **Define Generative Functions:** Declare the function you want, and let the
  LLM **be** the implementation.
- **Embed Semantic Indexes:** Select relevant tools and values based on natural
  language input.

This package is designed to be as lightweight as possible, with zero runtime
dependencies, and only a few small function definitions. `@toolcog/compiler`
handles transforming intrinsic function calls at build time. `@toolcog/runtime`
provides a pluggable runtime for interacting with AI models.

## Intrinsic Functions

Toolcog makes use of intrinsic functions that are transformed by the Toolcog
compiler at build time. These functions perform static analyses that are not
possible at runtime to generate descriptive tool schemas and embedded vector
indexes.

The Toolcog compiler is a transformer plugin for the TypeScript compiler.
No changes are made to the TypeScript language. The Toolcog compiler can be
integrated into any build tool that supports custom TypeScript transformers.
See the `@toolcog/compiler` package for more details.

### Generate LLM Tools

The `defineTool` intrinsic creates reliable LLM tools from TypeScript functions,
without the need for manual schema generation and cumbersome prompt engineering.

The following example creates an LLM tool that reads a text file from the local
file system.

#### Example tool generation

```typescript
import { defineTool } from "@toolcog/core";
import { readFile } from "node:fs/promises";

/**
 * Reads the contents of a text file from the local file system.
 *
 * @param path - The path to the file to read.
 * @returns The contents of the file, or an error object.
 */
const readTextFile = defineTool((path: string): Promise<string | Error> => {
  return readFile(path, "utf-8").catch((error: Error) => error);
});
```

#### The `defineTool` transformation

The Toolcog compiler:
- detects the `defineTool` call
- analyzes all types and documentation comments related to the function
- generates descriptive schemas that explain how to properly use the function
- replaces the `defineTool` call with a `Tool` implementation

### Define Generative Functions

The `definePrompt` intrinsic creates a function that invokes an LLM at runtime.
Generative functions turn LLMs into first class programming primitives.

#### Example generative function

The following example creates a generative function that uses an LLM to
generate synthetic HTTP request/response data compatible with the fetch API.

```typescript
import { definePrompt } from "@toolcog/core";

/**
 * Generate random HTTP request/response test vectors.
 *
 * @param requestCount - The number of test vectors to generate.
 * @returns An array containing `requestCount` simulated HTTP operations.
 */
const generateRequests = definePrompt<(requestCount: number) => {
  // The URL of the request.
  url: string,
  // The fetch API request initializer.
  request: RequestInit,
  // The simulated response to the request.
  response: ResponseInit,
}[]>();

// Usage
await generateRequests(5);
```

#### The `definePrompt` transformation

The Toolcog compiler:
- detects the `definePrompt<F>` call
- derives instructions for the LLM to follow from the documentation comment
  for the `definePrompt` call
- analyzes all types and documentation comments related to the function
  signature `F`
- generates descriptive schemas that explain how to interpret function
  arguments, and how to construct a return value
- replaces the `definePrompt` call with a `GenerativeFunction` implementation

### Embed Semantic Indexes

The `defineIndex` intrinsic declares an embedded vector index for mapping
natural language inputs to static values based on semantic similarity.
Vector embeddings are generated from descriptive phrases, called _idioms_,
associated with each static value in an index. Semantic indexes enable
efficient LLM tool selection and natural language classification.

#### Example semantic index

The following example creates an embedded semantic index for sentiment analysis.
`@idiom` tags associate descriptive phrases with each sentiment category.
The text embeddings of input strings are compared to the text embeddings of
the descriptive phrases in the index to determine the most similar value.

```typescript
import { defineIndex } from "@toolcog/core";

const sentiment = defineIndex([
  // @idiom The sentiment is joyful and upbeat.
  // @idiom The text expresses happiness.
  "positive",
  // @idiom The sentiment is gloomy and downbeat.
  // @idiom The text expresses sadness.
  "negative",
  // @idiom The sentiment is neutral and unbiased.
  // @idiom The text is informational.
  "neutral",
], { limit: 1 });

// Usage
await sentiment("I'm feeling over the moon today!");
```

#### The `defineIndex` transformation

The Toolcog compiler:
- detects the `defineIndex` call
- creates an `Idiom` object for each static value to index
- updates the `toolcog-manifest.yaml` file with all idioms needed by the index
- replaces the `defineIndex` call with an `Index` implementation

The Toolcog inventory tool:
- reads the `toolcog-manifest.yaml` file
- generates embedding vectors for all idioms
- creates a `toolcog-inventory.js` file containing the generated index

## Source code comments

Toolcog makes extensive use of source code comments to explain the structure
and behavior of your code to LLMs. Both block (`/** ... */`) and line (`// ...`)
comments are utilized. Declaration comments are accessed if an expression
doesn't have its own comment. And types are recursively traversed across
modules and packages to extract as much descriptive information as possible.

### Example

All comments in the following example contribute to the schemas generated for
the `calculateDistance` tool.

```typescript
import { defineTool } from "@toolcog/core";

/**
 * A point in 2D space.
 */
interface Point {
  // The x-coordinate.
  x: number;
  // The y-coordinate.
  y: number;
}

/**
 * Calculates the distance between two points.
 *
 * @param pointA - The first point.
 * @param pointB - The second point.
 * @returns The distance between `pointA` and `pointB`.
 */
const calculateDistance = defineTool((pointA: Point, pointB: Point): number => {
  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  return Math.sqrt(dx * dx + dy * dy);
});
```

## Runtime Interfaces

`@toolcog/core` also includes runtime interfaces used by `@toolcog/runtime`
and its associated plugins. See `@toolcog/runtime` for more details.
