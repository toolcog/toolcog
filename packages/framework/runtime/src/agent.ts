import { Emitter } from "@toolcog/util/emit";
import { AsyncContext } from "@toolcog/util/async";
import type { ToolSource } from "@toolcog/core";
import type { Message } from "./message.ts";

interface AgentContextOptions {
  messages?: Message[] | undefined;
  tools?: ToolSource[] | undefined;
}

type AgentContextEvents = {
  message: [message: Message, context: AgentContext];
  useTool: [tool: ToolSource, context: AgentContext];
  spawn: [child: AgentContext, parent: AgentContext];
};

class AgentContext extends Emitter<AgentContextEvents> {
  readonly #parent: AgentContext | null;
  readonly #messages: Message[];
  readonly #tools: ToolSource[];
  #query: string | undefined;

  constructor(
    parent: AgentContext | null = null,
    options?: AgentContextOptions,
  ) {
    super();

    this.#parent = parent;
    this.#messages = options?.messages ?? [];
    this.#tools = options?.tools ?? [];
    this.#query = undefined;
  }

  get parent(): AgentContext | null {
    return this.#parent;
  }

  get messages(): readonly Message[] {
    return this.#messages;
  }

  get tools(): readonly ToolSource[] {
    return this.#tools;
  }

  get query(): string | undefined {
    return this.#query;
  }

  addMessage(message: Message): void {
    this.#messages.push(message);
    this.emit("message", message, this);
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

  setQuery(query: string | undefined): void {
    this.#query = query;
  }

  clear(): void {
    this.#messages.length = 0;
    this.#tools.length = 0;
    this.#query = undefined;
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
      parent !== undefined ? parent.spawn(options) : new this(parent, options);
    return this.#current.run(child, func, child);
  }
}

const currentQuery = (): string | undefined => {
  return AgentContext.get()?.query;
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

export type { AgentContextOptions, AgentContextEvents };
export { AgentContext, currentQuery, currentTools, useTool, useTools };
