import { Emitter } from "@toolcog/util/emit";
import { AsyncContext } from "@toolcog/util/async";
import { splitSentences } from "@toolcog/util/nlp";
import type { Embeddings, ToolSource } from "@toolcog/core";
import type { Message } from "./message.ts";

/**
 * Agent configuration options.
 *
 * Toolkits and adapters may augment this type with additional options.
 */
interface AgentConfig {}

interface AgentContextOptions extends AgentConfig {
  tools?: ToolSource[] | undefined;
  messages?: Message[] | undefined;
  promptHysteresis?: number | undefined;
  splitPrompt?: ((prompt: string) => string[]) | boolean | undefined;
}

type AgentContextEvents = {
  useTool: [tool: ToolSource, context: AgentContext];
  message: [message: Message, context: AgentContext];
  spawn: [child: AgentContext, parent: AgentContext];
};

class AgentContext extends Emitter<AgentContextEvents> {
  readonly #parent: AgentContext | null;
  readonly #config: AgentConfig;
  readonly #tools: ToolSource[];
  readonly #messages: Message[];
  readonly #promptEmbeddings: Embeddings[];
  readonly #promptHysteresis: number;
  readonly #splitPrompt: ((prompt: string) => string[]) | undefined;

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

  get parent(): AgentContext | null {
    return this.#parent;
  }

  get config(): AgentConfig {
    return this.#config;
  }

  get tools(): readonly ToolSource[] {
    return this.#tools;
  }

  get messages(): readonly Message[] {
    return this.#messages;
  }

  get promptEmbeddings(): readonly Embeddings[] {
    return this.#promptEmbeddings;
  }

  get promptHysteresis(): number {
    return this.#promptHysteresis;
  }

  get splitPrompt(): ((prompt: string) => string[]) | undefined {
    return this.#splitPrompt;
  }

  useTool<const T extends ToolSource>(tool: T): T {
    this.#tools.push(tool);
    this.emit("useTool", tool, this);
    return tool;
  }

  useTools<const T extends readonly ToolSource[]>(tools: T): T {
    for (const tool of tools) {
      this.#tools.push(tool);
      this.emit("useTool", tool, this);
    }
    return tools;
  }

  addMessage(message: Message): void {
    this.#messages.push(message);
    this.emit("message", message, this);
  }

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

  clear(): void {
    this.#messages.length = 0;
    this.#promptEmbeddings.length = 0;
  }

  spawn(options?: AgentContextOptions): AgentContext {
    const child = new AgentContext(this, options);
    this.emit("spawn", child, this);
    return child;
  }

  static readonly #current = new AsyncContext.Variable<AgentContext>({
    name: "toolcog.agent",
  });

  static current(): AgentContext {
    const context = this.#current.get();
    if (context === undefined) {
      throw new Error("Not in a toolcog agent context");
    }
    return context;
  }

  static get(): AgentContext | null {
    return this.#current.get() ?? null;
  }

  static create(options?: AgentContextOptions): AgentContext {
    return new this(null, options);
  }

  static getOrCreate(options?: AgentContextOptions): AgentContext {
    let context = this.#current.get();
    if (context === undefined) {
      context = this.create(options);
    }
    return context;
  }

  static run<F extends (...args: any[]) => unknown>(
    context: AgentContext | null | undefined,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    return this.#current.run(context ?? undefined, func, ...args);
  }

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

const currentConfig = (): AgentConfig | undefined => {
  return AgentContext.get()?.config;
};

const currentTools = (): readonly ToolSource[] => {
  return AgentContext.get()?.tools ?? [];
};

const useTool = <const T extends ToolSource>(tool: T): T => {
  const context = AgentContext.current();
  return context.useTool(tool);
};

const useTools = <const T extends readonly ToolSource[]>(tools: T): T => {
  const context = AgentContext.current();
  return context.useTools(tools);
};

export type { AgentConfig, AgentContextOptions, AgentContextEvents };
export { AgentContext, currentConfig, currentTools, useTool, useTools };
