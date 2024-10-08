import { Emitter } from "@toolcog/util/emit";
import { AsyncContext } from "@toolcog/util/async";
import { splitSentences } from "@toolcog/util/nlp";
import type { Embeddings, ToolSource } from "@toolcog/core";
import type { Message } from "./message.ts";

/**
 * Agent configuration options. Toolkits and adapters may augment this
 * interface with additional options.
 */
interface AgentConfig {}

/**
 * Options for configuring an {@link AgentContext}.
 */
interface AgentContextOptions extends AgentConfig {
  /**
   * Tools available for use by LLMs when generating agent responses.
   */
  tools?: ToolSource[] | undefined;

  /**
   * The initial message history of the agent.
   */
  messages?: Message[] | undefined;

  /**
   * The number of recent prompts to consider for tool selection.
   */
  promptHysteresis?: number | undefined;

  /**
   * A function to split the prompt into fragments for more granular
   * tool selection. Splits prompts into sentences, by default.
   */
  splitPrompt?: ((prompt: string) => string[]) | boolean | undefined;
}

/**
 * Events emitted by an {@link AgentContext}.
 */
type AgentContextEvents = {
  useTool: [tool: ToolSource, context: AgentContext];
  message: [message: Message, context: AgentContext];
  spawn: [child: AgentContext, parent: AgentContext];
};

/**
 * The runtime state of an AI agent.
 */
class AgentContext extends Emitter<AgentContextEvents> {
  readonly #parent: AgentContext | null;
  readonly #config: AgentConfig;
  readonly #tools: ToolSource[];
  readonly #messages: Message[];
  readonly #promptEmbeddings: Embeddings[];
  readonly #promptHysteresis: number;
  readonly #splitPrompt: ((prompt: string) => string[]) | undefined;

  /**
   * Creates a new AI agent context.
   *
   * @param parent The context of the parent agent, if any.
   * @param options The configuration options for the agent.
   */
  constructor(
    parent: AgentContext | null = null,
    options: AgentContextOptions = {},
  ) {
    super();

    const {
      tools = [],
      messages = [],
      promptHysteresis = parent?.promptHysteresis ?? 5,
      splitPrompt,
      ...config
    } = options;

    this.#parent = parent;
    this.#config = config;
    this.#tools = tools;
    this.#messages = messages;

    this.#promptEmbeddings = [];
    this.#promptHysteresis = promptHysteresis;
    this.#splitPrompt =
      splitPrompt === undefined || splitPrompt === true ? splitSentences
      : splitPrompt === false ? undefined
      : splitPrompt;
  }

  /**
   * The context of the parent agent, if any.
   */
  get parent(): AgentContext | null {
    return this.#parent;
  }

  /**
   * The configuration options for the agent.
   */
  get config(): AgentConfig {
    return this.#config;
  }

  /**
   * The tools available for use by LLMs when generating agent responses.
   */
  get tools(): readonly ToolSource[] {
    return this.#tools;
  }

  /**
   * The message history for the agent.
   */
  get messages(): readonly Message[] {
    return this.#messages;
  }

  /**
   * A sliding window of recent prompt embeddings. Stores a maximum of
   * `promptHysteresis` embeddings.
   */
  get promptEmbeddings(): readonly Embeddings[] {
    return this.#promptEmbeddings;
  }

  /**
   * The number of recent prompts to consider for tool selection.
   */
  get promptHysteresis(): number {
    return this.#promptHysteresis;
  }

  /**
   * Splits the prompt into fragments for more granular tool selection.
   */
  get splitPrompt(): ((prompt: string) => string[]) | undefined {
    return this.#splitPrompt;
  }

  /**
   * Makes a tool available for use by LLMs when generating agent responses.
   *
   * @param tool - The tool to add.
   * @returns The added tool.
   */
  useTool<const T extends ToolSource>(tool: T): T {
    this.#tools.push(tool);
    this.emit("useTool", tool, this);
    return tool;
  }

  /**
   * Makes a set of tools available for use by LLMs when generating agent
   * responses.
   *
   * @param tools - The set of tools to add.
   * @returns The added tools.
   */
  useTools<const T extends readonly ToolSource[]>(tools: T): T {
    for (const tool of tools) {
      this.#tools.push(tool);
      this.emit("useTool", tool, this);
    }
    return tools;
  }

  /**
   * Adds a message to the agent's message history.
   *
   * @param message - The message to add.
   */
  addMessage(message: Message): void {
    this.#messages.push(message);
    this.emit("message", message, this);
  }

  /**
   * Adds a prompt to the agent's prompt embedding history.
   *
   * @param prompt - The prompt to add.
   */
  addPrompt(prompt: string): void {
    const promptEmbeddings = this.#promptEmbeddings;
    const promptCount = promptEmbeddings.length;
    if (promptCount >= this.#promptHysteresis) {
      promptEmbeddings.splice(0, promptCount - this.#promptHysteresis + 1);
    }

    const fragments = this.splitPrompt?.(prompt) ?? [prompt];
    const embeddings = Object.fromEntries(
      fragments.map((fragment) => [fragment, {}]),
    );
    promptEmbeddings.push(embeddings);
  }

  /**
   * Clears the agent's message and prompt embedding history.
   */
  clear(): void {
    this.#messages.length = 0;
    this.#promptEmbeddings.length = 0;
  }

  /**
   * Creates a new child agent context.
   *
   * @param options - The configuration options for the child agent.
   * @returns The new child agent context.
   */
  spawn(options?: AgentContextOptions): AgentContext {
    const child = new AgentContext(this, options);
    this.emit("spawn", child, this);
    return child;
  }

  /**
   * Async local storage for the currently active agent context.
   */
  static readonly #current = new AsyncContext.Variable<AgentContext>({
    name: "toolcog.agent",
  });

  /**
   * Returns the agent context that's active for the current async context.
   *
   * @throws If not currently running in an agent context.
   */
  static current(): AgentContext {
    const context = this.#current.get();
    if (context === undefined) {
      throw new Error("Not in a toolcog agent context");
    }
    return context;
  }

  /**
   * Returns the agent context that's active for the current async context,
   * or `null` if not currently running in an agent context.
   */
  static get(): AgentContext | null {
    return this.#current.get() ?? null;
  }

  /**
   * Creates a new agent context.
   *
   * @param options - The configuration options for the agent.
   * @returns The new agent context.
   */
  static create(options?: AgentContextOptions): AgentContext {
    return new this(null, options);
  }

  /**
   * Returns the agent context that's active for the current async context,
   * creating a new one if not already running in an agent context.
   *
   * @param options - The configuration options for the agent.
   * @returns The current agent context.
   */
  static getOrCreate(options?: AgentContextOptions): AgentContext {
    let context = this.#current.get();
    if (context === undefined) {
      context = this.create(options);
    }
    return context;
  }

  /**
   * Runs a function in the context of the specified agent.
   *
   * @param context - The agent context in which to run the function,
   * or `null` to run the function outside of any agent context.
   * @param func - The function to run in the agent context.
   * @param args - The arguments to pass to the function.
   * @returns The return value of the function.
   */
  static run<F extends (...args: any[]) => unknown>(
    context: AgentContext | null | undefined,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    return this.#current.run(context ?? undefined, func, ...args);
  }

  /**
   * Runs a function in a new agent context.
   *
   * @param options - The configuration options for the new agent.
   * @param func - The function to run in the new agent context.
   * @returns The return value of the function.
   */
  static spawn<R>(
    options: AgentContextOptions | undefined,
    func: (context: AgentContext) => R,
  ): R {
    const parent = this.#current.get();
    const child =
      parent !== undefined ? parent.spawn(options) : this.create(options);
    return this.#current.run(child, func, child);
  }
}

/**
 * Returns the configuration options for the current agent context.
 *
 * @returns The current agent's configuration options, or `undefined` if not
 * currently running in an agent context.
 */
const currentConfig = (): AgentConfig | undefined => {
  return AgentContext.get()?.config;
};

/**
 * Returns the tools available for use by LLMs when generating agent responses.
 *
 * @returns The current agent's tools, or an empty array if not currently
 * running in an agent context.
 */
const currentTools = (): readonly ToolSource[] => {
  return AgentContext.get()?.tools ?? [];
};

/**
 * Makes a tool available for use by the current agent.
 *
 * @param tool - The tool to add.
 * @returns The added tool.
 */
const useTool = <const T extends ToolSource>(tool: T): T => {
  const context = AgentContext.current();
  return context.useTool(tool);
};

/**
 * Makes a set of tools available for use by the current agent.
 *
 * @param tools - The set of tools to add.
 * @returns The added tools.
 */
const useTools = <const T extends readonly ToolSource[]>(tools: T): T => {
  const context = AgentContext.current();
  return context.useTools(tools);
};

export type { AgentConfig, AgentContextOptions, AgentContextEvents };
export { AgentContext, currentConfig, currentTools, useTool, useTools };
