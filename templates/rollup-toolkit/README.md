# Toolcog Template: Toolkit with Rollup

This template showcases how to build a Toolcog toolkit using
[Rollup](https://rollupjs.org) as the build system. A Toolcog toolkit is a
collection of LLM tools defined as ordinary TypeScript functions. The Toolcog
compiler uses static analysis to generate descriptive schemas for each tool
function, and to generate an embedded semantic index for efficient tool
selection.

The template includes example code for defining LLM tools that perform file
system operations.

## Quick Start

Clone the template, install dependencies, and build the project:

```sh
git clone https://github.com/toolcog/toolcog.git
cd toolcog/templates/toolkit-rollup
npm install
npm run build
```

## Project Structure

The template project is organized as follows:

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
├── package.json                # package configuration
├── rollup.config.ts            # rollup configuration
└── tsconfig.json               # typescript configuration
```

## Commands

The following commands can be run in the project's root directory:

| Command                     | Action                                        |
|-----------------------------|-----------------------------------------------|
| `npm install`               | Installs dependencies                         |
| `npm run build`             | Builds the library                            |
| `npm run generate`          | Generates the Toolcog inventory file          |
| `npm run toolcog`           | Runs the Toolcog REPL with the toolkit loaded |
| `npm run toolcog -- --help` | Prints Toolcog CLI usage information          |

## Using the Toolkit to Modify Itself

You can test out the toolkit with an LLM using the Toolcog REPL. Because the
toolkit contains tools for reading and writing files, you use it to modify the
toolkit's own source code. The example below asks AI to add a new tool to the
toolkit, which in turn uses the tools in the toolkit to modify itself!

```
# Make sure you have an OpenAI API key defined in your environment
#OPENAI_API_KEY="..."
npm run toolcog -- --print-tool-args

Welcome to Toolcog v0.1.0 (Node.js v22.9.0, TypeScript v5.6.3).
Evaluate TypeScript code, define LLM tools, and chat with AI. Type /help to learn more.

1> List the files in the current directory.
✓ gpt-4o-2024-08-06:
✓ toolcog-rollup-toolkit-template:listDirectory:
  [Tool Arguments]
  path: ./
✓ gpt-4o-2024-08-06:
  Here are the files and directories in the current directory:

  - .gitignore
  - .toolcog/
  - .turbo/
  - README.md
  - dist/
  - node_modules/
  - package.json
  - rollup.config.js
  - src/
  - tsconfig.json

2> Give me a brief one paragraph summary of the source code.
✓ gpt-4o-2024-08-06:
✓ toolcog-rollup-toolkit-template:listDirectory:
  [Tool Arguments]
  path: ./src
✓ gpt-4o-2024-08-06:
✓ toolcog-rollup-toolkit-template:readTextFile:
  [Tool Arguments]
  path: ./src/fs.ts
✓ toolcog-rollup-toolkit-template:readTextFile:
  [Tool Arguments]
  path: ./src/lib.ts
✓ gpt-4o-2024-08-06:
  The source code consists of two main files, fs.ts and lib.ts. The fs.ts file
  defines a set of functions or tools for interacting with the local file
  system, such as creating directories, listing directory contents, reading
  text files, and writing text files. These functions utilize Node.js's file
  system promises and include error handling. The lib.ts file exports these
  tools and defines a toolkit named "toolcog-rollup-toolkit-template," which
  packages these tools for use in local file system operations. This toolkit is
  versioned as 0.0.1, indicating it might be in an early development stage. The
  code emphasizes modular design, allowing individual tool usage as well as
  collective functionality through the toolkit export.

3> Add a new tool to that reports file stats. Make sure to preserve all the existing tools.
✓ gpt-4o-2024-08-06:
✓ toolcog-rollup-toolkit-template:readTextFile:
  [Tool Arguments]
  path: ./src/lib.ts
✓ gpt-4o-2024-08-06:
✓ toolcog-rollup-toolkit-template:readTextFile:
  [Tool Arguments]
  path: ./src/fs.ts
✓ gpt-4o-2024-08-06:
✓ toolcog-rollup-toolkit-template:writeTextFile:
  [Tool Arguments]
  path: ./src/fs.ts
  text: >
    ...
✓ gpt-4o-2024-08-06:
✓ toolcog-rollup-toolkit-template:writeTextFile:
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
