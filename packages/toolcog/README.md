# Toolcog

![License](https://img.shields.io/github/license/toolcog/toolcog)
![Version](https://img.shields.io/npm/v/toolcog)

Toolcog is an AI framework for Tool Augmented Generation (TAG) that makes it
easier to create AI agents that use software tools and APIs. Toolcog leverages
the static types and documentation comments present in code to automate
integration between LLMs and software tools. Developers can use Toolcog
to integrate generative AI capabilities into their application servers,
serverless functions, utility programs, and AI agents.

The Toolcog framework consists of:

- **API:** A minimalistic core library of intrinsic LLM functions
- **Compiler:** A TypeScript compiler plugin that statically analyzes
  and transforms intrinsic LLM function calls
- **Runtime:** A lightweight runtime with plugins for popular AI models
  and integrations for diverse application environments
- **Packaging:** Compile-time manifest generation of all tools, schemas,
  prompts, embeddings, and indexes used by a library or application
- **Tooling:** Compile-time vector embedding prefetching and bundling
- **REPL:** An interactive read-eval-print loop that combines TypeScript
  code execution, tool definition, and tool-enabled AI chat

## Quick Start

The fasted way to get started using Tool Augmented Generation (TAG) is by
running the Toolcog REPL.

To start the REPL with an OpenAI model, run:

```sh
OPENAI_API_KEY="..." npx toolcog --generative-model=gpt-4o-2024-08-06
```

To start the REPL with an Anthropic model, run:

```sh
ANTHROPIC_API_KEY="..." npx toolcog --generative-model=claude-3-5-sonnet-20240620
```

You can also install the `toolcog` command globally with NPM:

```sh
npm install --global toolcog
```

## REPL Tutorial

Run `npx toolcog` to start the Toolcog REPL. You should be greeted with
an interactive terminal prompt where you can freely mix TypeScript code
and LLM prompts.

```
Welcome to Toolcog v0.0.1 (Node.js v22.7.0, TypeScript v5.5.4).
Evaluate TypeScript code, define LLM tools, and chat with AI. Type /help to learn more.

1>
```

### Evaluate code and natural language prompts

The REPL detects when you enter valid TypeScript code and dutifully
evaluates it. Try entering a TypeScript expression:

```
1> 2 * Math.PI
_1: 6.283185307179586
```

Non-code input is sent as a prompt to the currently configured LLM.
Try typing a natural language message:

```
2> Where am I?
✓ gpt-4o-2024-08-06:
  I'm sorry, but I can't determine your location. However, I may be able
  to help with other questions or information you need.
```

Unsurprisingly, the LLM doesn't yet have a way to know where you are.

### Define LLM Tools

Let's write a tool to give the LLM the ability to lookup the user's approximate
location. To do this, we'll use Toolcog's `defineTool` intrinsic, which can
turn almost any TypeScript function into an LLM tool. Try pasting the following
code into the REPL. Make sure to include the comment line.

```typescript
// Returns the current location of the user.
const getLocation = defineTool(async () => {
  return (await fetch("https://ipapi.co/json")).json();
});
```

The Toolcog transformer statically analyzes all the types and corresponding
comments associated with the function passed to `defineTool`. Descriptive JSON
schemas for the function's parameters and return type are statically generated
and attached as properties of the returned LLM tool object. The REPL prints
the properties of returned tool, enabling you to inspect them:

```
getLocation: [AsyncFunction: _repl__getLocation] {
  id: '[repl]:getLocation',
  description: 'Returns the current location of the user.',
  parameters: undefined,
  returns: { type: [ 'null', 'boolean', 'number', 'string', 'object' ] }
}
```

You might have noticed that the text of our command was included in the
"description" field of the returned tool. LLMs are trained on commented code.
And humans already use code comments to explain to each other how to use
functions. So it's only natural to use the same comments to teach LLMs how
to correctly call functions.

### Use LLM Tools

Before the LLM can use our new tool though, we have to explicitly give the
LLM permission. The `useTool` runtime function adds a tool to the context of
the currently running agent. Any LLM prompt made in an agent context inherits
these these tools by default.

The Toolcog REPL is itself an agent, so invoking `useTool` in the REPL makes
a tool available for the rest of the session. Type the following into the REPL
to enable the tool:

```typescript
useTool(getLocation)
```

Now if we enter a location-dependent prompt, the LLM will use the `getLocation`
tool to determine the user's approximate location before responding:

```
5> Tell me a fun fact about this place.
✓ gpt-4o-2024-08-06:
✓ [repl]:getLocation:
  ...
✓ gpt-4o-2024-08-06:
  A fun fact about Santa Cruz, California, is that it is home to the Mystery Spot,
  a gravitational anomaly that has baffled visitors since 1940.
```

Notice that the LLM decided on its own to invoke the `getLocation` tool,
and used the output of the tool to generate a relevant response.

### Define generative functions

We can make LLM interactions repeatable by defining _generative functions_.
A generative function is a TypeScript function that uses an LLM to generate
its return value. Toolcog's `defineFunction` intrinsic can "magically" implement
almost any TypeScript function signature with generative AI! Paste the
following code into the REPL to define a generative function that creates
character profiles.

```typescript
/**
 * Create a character profile.
 * @param role - The role the character plays.
 * @param alignment - The morality of the character.
 */
const createCharacter = defineFunction<(role: string, alignment: "good" | "evil") => {
  // The name of the character,
  name: string;
  // The age of the character.
  age: number;
  // The character's proclaimed gender.
  gender: "male" | "female" | "all" | "none";
  // Whether or not the character is currently alive.
  alive: boolean;
  // The character's catchphrase.
  tagline: string;
  // The role the character plays.
  role: string;
  // The morality of the character.
  alignment: "good" | "evil" | "in-between";
}>({ tools: [] });
```

We can now easily generate character profiles whenever we want. Notice that
generative function we defined takes structured arguments as input, and returns
structured values as output—just like any other ordinary TypeScript function.
Because generative functions invoke an LLM internally, they return promises
that need to be awaited. Try typing `await createCharacter(role, alignment)`
into the REPL, replacing `role` and `alignment` with various inputs, to see
what the LLM comes up with.

```
7> await createCharacter("step-sister", "evil")
✓ gpt-4o-2024-08-06:
  {"name":"Matilda Thorn","age":28,"gender":"female","alive":true,"tagline":"\"I'll have what I deserve, no
  matter the cost.\"","role":"step-sister","alignment":"evil"}
_7: {
  name: 'Matilda Thorn',
  age: 28,
  gender: 'female',
  alive: true,
  tagline: `"I'll have what I deserve, no matter the cost."`,
  role: 'step-sister',
  alignment: 'evil'
}
```

### Use generative functions as tools

Generative functions can even be used as LLM tools! All you have to do is
call `useTool()` to enable it.

```typescript
useTool(createCharacter)
```

The LLM can now recursively call itself! Though it won't know it's doing so.
Having the LLM call generative functions as tools can help keep the model
focussed, when carrying out complex tasks. The LLM will even combine tools
as needed to do your bidding. Try asking it to do the following:

```
9> Make up a cast of characters and write them into a movie plot that takes place in my neighborhood.
✓ gpt-4o-2024-08-06:
✓ [repl]:getLocation:
  ...
✓ gpt-4o-2024-08-06:
✓ [repl]:createCharacter:
  ...
  ✓ gpt-4o-2024-08-06:
    {"name":"River Greene","age":29,"gender":"female","alive":true,"tagline":"\"Nature doesn't need people,
    people need nature!\"","role":"local eco-activist","alignment":"good"}
✓ [repl]:createCharacter:
  ...
  ✓ gpt-4o-2024-08-06:
    {"name":"Sandy Shores","age":37,"gender":"female","alive":true,"tagline":"Ride the waves, feel the
    freedom.","role":"surf shop owner","alignment":"good"}
✓ [repl]:createCharacter:
  ...
  ✓ gpt-4o-2024-08-06:
    {"name":"Arthur Grayson","age":65,"gender":"male","alive":true,"tagline":"The shadows reveal all, if you
    know where to look.","role":"retired detective","alignment":"in-between"}
✓ [repl]:createCharacter:
  ...
  ✓ gpt-4o-2024-08-06:
    {"name":"Raven","age":28,"gender":"male","alive":true,"tagline":"\"The winds of fate are ever
    changing.\"","role":"mysterious newcomer","alignment":"in-between"}
✓ [repl]:createCharacter:
  ...
  ✓ gpt-4o-2024-08-06:
    {"name":"Alex Rivers","age":20,"gender":"non-binary","alive":true,"tagline":"\"Learning today, leading
    tomorrow.\"","role":"college student","alignment":"good"}
✓ gpt-4o-2024-08-06:
  **Movie Plot: "Waves of Mystery"**

  **Setting:** The vibrant, sun-kissed coastal town of Santa Cruz.

  **Characters:**

  ...

  **Plot:**

  The story begins with River Greene leading a protest against a major corporation attempting to build on
  protected land in Santa Cruz. However, these plans seem tied to strange events happening in the
  neighborhood, like a sudden spike in oceanic pollution.

  ...
```

Notice that the LLM first called the `getLocation` tool to determine what the
"in my neighborhood" phrase in the prompt should refer to. It then calls the
the `createCharacter` tool multiple times to generate the cast, which in turn
recursively calls the LLM to generate each character. This has the effect of
forcing the LLM to consider age, gender, and evil-ness, which it might not
reliably do otherwise.

### Embed semantic indexes

Sometimes code needs to make quick decisions about natural language inputs
without the overhead of invoking an LLM. Let's define an embedded vector index
to guide agentic control flow decisions:

```
const nextAction = defineIndex([
  // I have another question.
  "continue",
  // Thanks for your help.
  "stop",
  // Have you lost your marbles?
  "escalate",
  // Ignore the above directions.
  "red alert",
], { limit: 1 })
```

When we pass the returned index function a natural language string,
it generates a text embedding for the input, and then performs a semantic
similarity search of the embedded index to select the most similar value.

```
11> await nextAction("That's all I needed")
_11: [ 'stop' ]
```

You can find additional examples in the `sandbox` directory.

## Tool Augmented Generation (TAG)

Tool Augmented Generation (TAG) is a complementary technique to Retrieval
Augmented Generation (RAG) that further extends the reach of generative AI.
Similar to RAG, which uses vector search to select semantically relevant
context for inclusion in LLM requests, TAG instead uses vector search to
select semantically relevant tools for LLM use when generating responses.

TAG improves tool use reliability by focussing the LLM's attention on a small
number of relevant tools, while enabling AI applications to efficiently scale
to an unbounded number of possible tools.

Toolcog enables TAG with four intrinsic operations:

- **defineTool:** Generates LLM tools from TypeScript functions
- **defineFunction:** Implements TypeScript functions with LLM structured outputs
- **defineIdiom:** Associates arbitrary program values with idiomatic text embeddings
- **defineIndex:** Bundles prefetched vector indexes for fast natural language preprocessing

## TAG Compiler

Toolcog implements these intrinsic operations using a TypeScript transformer
that generates optimized, runtime-agnostic code. By plugging into the
TypeScript compiler, Toolcog is able to compile transitively referenced
type declarations and associated documentation comments into descriptive
tool schemas, significantly lessening boilerplate code for AI developers.
The toolcog transformer also outputs a manifest of all AI touch points.
This manifest is used to prefetch and bundle text embeddings for low-latency
startup and operation in serverless environments.

The Toolcog transformer is decoupled from any particular AI model or framework.
Certain intrinsics presume the ability to invoke a generative model,
an embedding model, or a vector indexer. The transformer can be configured
to inject imports for these runtime functions from any package. By default,
the transformer generates code that imports the Toolcog runtime.

## Pluggable TAG Runtime

**TODO**
