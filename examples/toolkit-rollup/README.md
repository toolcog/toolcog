# Toolcog Toolkit with Rollup

This example demonstrates how to build a Toolcog toolkit using [Rollup][rollup]
and [@rollup/plugin-typescript][@rollup/plugin-typescript] to transpile and
bundle the TypeScript code.

A Toolcog toolkit is a collection of LLM tools defined as ordinary TypeScript
functions. The Toolcog compiler uses static analysis to generate descriptive
schemas for each tool function, and to generate an embedded semantic index for
efficient tool selection. Sample code is included that defines simple LLM tools
for file system operations.

## Getting Started

Clone the repository, install dependencies, and build the project:

```sh
git clone https://github.com/toolcog/toolcog.git
cd toolcog/examples/toolkit-rollup
npm install
npm run build
```

After building the library, you can use the toolkit with an LLM via the
Toolcog REPL. Make sure you have an `OPENAI_API_KEY` variable defined in your
environment. OpenAI is used to generate embeddings, even when using an LLM
from a different vendor.

```sh
npm run toolcog -- --print-tool-args
```

To use the Toolcog REPL with Claude, make sure you have an `ANTHROPIC_API_KEY`
variable defined in your environment, and use the `--generative-model` option
to specify your desired language model.

```sh
npm run toolcog -- --generative-model=claude-3-5-sonnet-20240620 --print-tool-args
```

## Project Structure

The example project is organized as follows:

```
/
├── .toolcog/
│   └── precache.yaml           # pre-generated embeddings cache
├── dist/
│   ├── lib.cjs                 # cjs library bundle
│   ├── lib.d.ts                # dts library bundle
│   ├── lib.js                  # esm library bundle
│   ├── toolcog-inventory.js    # pre-generated inventory of AI assets
│   ├── toolcog-inventory.yaml  # pre-generated inventory of AI assets
│   └── toolcog-manifest.yaml   # compiler-generated manifest of AI declarations
├── src/
│   ├── fs.ts                   # LLM tools for filesystem operations
│   └── lib.ts                  # library entry point
├── eslint.config.js            # eslint configuration
├── package.json                # package configuration
├── prettier.config.js          # prettier configuration
├── rollup.config.ts            # rollup configuration
├── tsconfig.json               # typescript configuration
└── turbo.json                  # turborepo configuration
```

## Toolcog Configuration

The Toolcog compiler is configured via the `transformers` property of the
`typescript` plugin in `rollup.config.ts`.

```javascript
import { defineConfig } from "rollup";
import typescript from "@rollup/plugin-typescript";
import { toolcogTransformer } from "@toolcog/compiler";

export default defineConfig({
  // Rollup configuration ...

  plugins: [
    // Additional rollup plugins ...

    // Transpile TypeScript to JavaScript.
    typescript({
      transformers: (program) => ({
        before: [
          // Enable the Toolcog transformer. Default option values are
          // included below for reference.
          toolcogTransformer(program, {
            // The name of the Toolcog manifest file; gets resolved against
            // the typescript output directory.
            manifestFile: "toolcog-manifest.yaml",

            // Disables manifest generation and inventory hook injection.
            standalone: false,

            // Includes the package name in generated IDs.
            packageId: true,
            // Includes module paths in generated IDs.
            moduleId: true,

            // Injected runtime hook for invoking generative models.
            generatorImport: ["generate", "@toolcog/runtime"],
            // Injected runtime hook for invoking embedding models.
            embedderImport: ["embed", "@toolcog/runtime"],
            // Injected runtime hook for creating semantic indexes.
            indexerImport: ["index", "@toolcog/runtime"],
            // Injected runtime hook for resolving idiom embeddings.
            idiomResolverImport: ["resolveIdiom", "@toolcog/runtime"],
            // Injected runtime hook for accessing contextually scoped tools..
            contextToolsImport: ["currentTools", "@toolcog/runtime"],

            // Prevents removal of compile-time API imports.
            keepIntrinsicImports: false,
          }),
        ],
      }),
    }),
  ],
});
```

## Commands

Here are the main commands to build and use the toolkit:

| Command                     | Action                                         |
|-----------------------------|------------------------------------------------|
| `npm install`               | Installs dependencies                          |
| `npm run rollup`            | Builds the library                             |
| `npm run build`             | Builds the library and generates its inventory |
| `npm run inventory`         | Generates the Toolcog embedding inventory      |
| `npm run toolcog`           | Runs the Toolcog REPL with the toolkit loaded  |
| `npm run toolcog -- --help` | Prints Toolcog CLI usage information           |

The following commands are useful for development:

| Command                     | Action                                         |
|-----------------------------|------------------------------------------------|
| `npm run check`             | Type checks the source code                    |
| `npm run lint`              | Lints the source code                          |
| `npm run format`            | Formats the source code                        |
| `npm run clean`             | Removes generated build files                  |
| `npm run clean-all`         | Removes all untracked files                    |

[Turborepo][turborepo] is the recommended way to run continuous development
builds:

| Command                     | Action                                         |
|-----------------------------|------------------------------------------------|
| `npx turbo build`           | Builds the library with caching enabled        |
| `npx turbo watch build`     | Rebuilds the library on source change          |

## Using the Toolkit to Modify Itself

You can test out the toolkit with an LLM using the Toolcog REPL. Because the
toolkit contains tools for reading and writing files, you use it to modify the
toolkit's own source code. The example below asks AI to add a new tool to the
toolkit, which in turn uses the tools defined by the toolkit to modify itself!

```
# Make sure you have an OpenAI API key defined in your environment
#OPENAI_API_KEY="..."

npm run toolcog -- --print-tool-args

Welcome to Toolcog v0.1.0 (Node.js v22.9.0, TypeScript v5.6.3).
Evaluate TypeScript code, define LLM tools, and chat with AI. Type /help to learn more.

1> List the files in the current directory.
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_rollup:listDirectory:
  [Tool Arguments]
  path: ./
✓ gpt-4o-2024-08-06:
  Here are the files and directories in the current directory:

  - .toolcog/
  - .turbo/
  - dist/
  - node_modules/
  - src/
  - .gitignore
  - eslint.config.js
  - package.json
  - prettier.config.js
  - README.md
  - rollup.config.js
  - tsconfig.json
  - turbo.json

2> Give me a brief one paragraph summary of the code in the src directory.
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_rollup:listDirectory:
  [Tool Arguments]
  path: ./src
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_rollup:readTextFile:
  [Tool Arguments]
  path: ./src/fs.ts
✓ _example_toolkit_rollup:readTextFile:
  [Tool Arguments]
  path: ./src/lib.ts
✓ gpt-4o-2024-08-06:
  The source code consists of two main files, `fs.ts` and `lib.ts`. The `fs.ts`
  file defines a set of functions or tools for interacting with the local file
  system, such as creating directories, listing directory contents, reading
  text files, and writing text files. These functions utilize Node.js's file
  system promises and include error handling. The `lib.ts` file exports these
  tools and defines a toolkit named `"@example/toolkit-rollup"`, which packages
  these tools for use in local file system operations. This toolkit is
  versioned as 0.0.1, indicating it might be in an early development stage.
  The code emphasizes modular design, allowing individual tool usage as well
  as collective functionality through the toolkit export.

3> Add a new tool to that reports file stats. Make sure to preserve all the existing tools.
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_rollup:readTextFile:
  [Tool Arguments]
  path: ./src/lib.ts
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_rollup:readTextFile:
  [Tool Arguments]
  path: ./src/fs.ts
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_rollup:writeTextFile:
  [Tool Arguments]
  path: ./src/fs.ts
  text: >
    ...
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_rollup:writeTextFile:
  [Tool Arguments]
  path: ./src/lib.ts
  text: >
    ...
✓ gpt-4o-2024-08-06:
  I have added a new tool called getFileStats to the toolkit. This tool allows
  you to get file statistics from the local file system. All existing tools
  have been preserved and are still available in the toolkit. Here's a summary
  of the tools now included in the toolkit:

  1. makeDirectory: Creates a directory on the local file system.
  2. listDirectory: Lists the files in a directory.
  3. readTextFile: Reads the contents of a text file.
  4. writeTextFile: Writes text to a file.
  5. getFileStats: Retrieves file statistics such as size, creation date, and
     modification date.

  Each tool is designed to handle errors gracefully by returning an error
  object if any issues occur.
```

[rollup]: https://rollupjs.org
[@rollup/plugin-typescript]: https://github.com/rollup/plugins/tree/master/packages/typescript#readme
[turborepo]: https://turbo.build/repo/docs
