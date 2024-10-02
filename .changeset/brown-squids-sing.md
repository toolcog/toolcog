---
"@toolcog/runtime": minor
"@toolcog/anthropic": minor
"@toolcog/repl": minor
"@toolcog/openai": minor
"@toolcog/node": minor
---

Add command line options to control REPL output.

The `--print-markdown` options preserves markdown formatting in LLM responses.
Without this option, LLM responses will be ANSI stylized with their markdown
syntax removed, making them more readable. With this option, LLM responses
will be ANSI stylized, while retaining their markdown syntax.

The `--print-tools` options prints the list of tools provided to the LLM
for each generation call.

The `--print-tool-args` prints the arguments the LLM provides when calling
a tool.

The `--print-tool-results` prints the return value of an LLN tool call.
Tool results are now omitted from the output by default, as they can be
quite verbose.
