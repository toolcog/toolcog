# Toolcog Toolkit with TSC and SWC

This example demonstrates how to build a Toolcog toolkit using the TypeScript
compiler (patched with [ts-patch][ts-patch]) to transpile TypeScript code to
ES modules, and [SWC][swc] to generate CommonJS modules.

A Toolcog toolkit is a collection of LLM tools defined as ordinary TypeScript
functions. The Toolcog compiler uses static analysis to generate descriptive
schemas for each tool function, and to generate an embedded semantic index for
efficient tool selection. Sample code is included that defines simple LLM tools
for file system operations.

## Getting Started

Clone the repository, install dependencies, and build the project:

```sh
git clone https://github.com/toolcog/toolcog.git
cd toolcog/examples/toolkit-tsc
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
│   ├── lib.cjs                 # cjs entry point
│   ├── lib.d.ts                # dts entry point
│   ├── lib.js                  # esm entry point
│   ├── toolcog-inventory.js    # pre-generated inventory of AI assets
│   ├── toolcog-inventory.yaml  # pre-generated inventory of AI assets
│   └── toolcog-manifest.yaml   # compiler-generated manifest of AI declarations
├── src/
│   ├── fs.ts                   # LLM tools for filesystem operations
│   └── lib.ts                  # library entry point
├── .swcrc                      # swc configuration
├── eslint.config.js            # eslint configuration
├── package.json                # package configuration
├── prettier.config.js          # prettier configuration
├── tsconfig.json               # typescript configuration
└── turbo.json                  # turborepo configuration
```

## Toolcog Configuration

The Toolcog compiler is configured via the `plugins` property of the
`compilerOptions` in `tsconfig.json`.

```jsonc
{
  "compilerOptions": {
    // Other typescript compiler options ...

    "plugins": [
      // Enable the Toolcog transformer. Default option values are included
      // below for reference.
      {
        // The module name that contains the typescript transformer.
        "transform": "@toolcog/compiler",

        // The name of the Toolcog manifest file; gets resolved against
        // the typescript output directory.
        "manifestFile": "toolcog-manifest.yaml",

        // Disables manifest generation and inventory hook injection.
        "standalone": false,

        // Includes the package name in generated IDs.
        "packageId": true,
        // Includes module paths in generated IDs.
        "moduleId": true,

        // Injected runtime hook for invoking generative models.
        "generatorImport": ["generate", "@toolcog/runtime"],
        // Injected runtime hook for invoking embedding models.
        "embedderImport": ["embed", "@toolcog/runtime"],
        // Injected runtime hook for creating semantic indexes.
        "indexerImport": ["index", "@toolcog/runtime"],
        // Injected runtime hook for resolving idiom embeddings.
        "idiomResolverImport": ["resolveIdiom", "@toolcog/runtime"],
        // Injected runtime hook for accessing contextually scoped tools..
        "contextToolsImport": ["currentTools", "@toolcog/runtime"],

        // Prevents removal of compile-time API imports.
        "keepIntrinsicImports": false,
      }
    ],
  }
}
```

## Commands

Here are the main commands to build and use the toolkit:

| Command                     | Action                                         |
|-----------------------------|------------------------------------------------|
| `npm install`               | Installs dependencies                          |
| `npm run build:esm`         | Transpiles TypeScript to JavaScript with tspc  |
| `npm run build:cjs`         | Transpiles ESM to CJS with SWC                 |
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
✓ _example_toolkit_tsc:listDirectory:
  [Tool Arguments]
  path: ./
✓ gpt-4o-2024-08-06:
  Here are the files and directories in the current directory:

  - .swc/
  - .toolcog/
  - .turbo/
  - dist/
  - node_modules/
  - src/
  - .gitignore
  - .swcrc
  - eslint.config.js
  - package.json
  - prettier.config.js
  - README.md
  - tsconfig.json
  - turbo.json

2> Give me a brief one paragraph summary of the code in the src directory.
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_tsc:listDirectory:
  [Tool Arguments]
  path: ./src
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_tsc:readTextFile:
  [Tool Arguments]
  path: ./src/fs.ts
✓ _example_toolkit_tsc:readTextFile:
  [Tool Arguments]
  path: ./src/lib.ts
✓ gpt-4o-2024-08-06:
  The src directory contains two TypeScript files, `fs.ts` and `lib.ts`, that
  together form a toolkit for interacting with the file system. The `fs.ts`
  file defines several asynchronous utility functions such as `makeDirectory`,
  `listDirectory`, `readTextFile`, and `writeTextFile`, which facilitate
  operations like creating directories, listing directory contents, and reading
  from or writing to text files using the Node.js `fs/promises` module.
  Additionally, these functions include error handling and support for
  resolving file paths, including tilde (`~`) expansion for home directories.
  The `lib.ts` file exports these tools both individually and as part of an
  example toolkit module named `@example/toolkit-tsc`, which is designed for
  use with large language models (LLMs) for purposes that require file system
  interactions.

3> Add a new tool to that reports file stats. Make sure to preserve all the existing tools.
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_tsc:readTextFile:
  [Tool Arguments]
  path: ./src/lib.ts
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_tsc:readTextFile:
  [Tool Arguments]
  path: ./src/fs.ts
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_tsc:writeTextFile:
  [Tool Arguments]
  path: ./src/fs.ts
  text: >
    ...
✓ gpt-4o-2024-08-06:
✓ _example_toolkit_tsc:writeTextFile:
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

[ts-patch]: https://github.com/nonara/ts-patch
[swc]: https://swc.rs
[turborepo]: https://turbo.build/repo/docs
