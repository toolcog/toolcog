---
"@toolcog/compiler": minor
"@toolcog/runtime": minor
"@toolcog/core": minor
"@toolcog/repl": minor
"toolcog": minor
---

Make `Tool` and `GenerativeFunction` conform to the `Idiom` interface.

This removes the extra step of having to separately define idioms for tools.
Fully runtime-independent tools can still be created by compiling with the
`standalone` toolcog transformer option set to `true`.

Rename `defineFunction` back to `definePrompt`. `defineFunction` was a little
too generic. Since generative functions are in a sense wired-up prompt
generators, it's not inconsistent for the intrinsic that creates them to be
called `definePrompt`. `definePrompt` also better complements the accompanying
`prompt` intrinsic for defining and immediately invoking a generative function.
