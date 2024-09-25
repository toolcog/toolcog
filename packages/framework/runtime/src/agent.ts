import { deepEqual } from "@toolcog/util";
import { Emitter } from "@toolcog/util/emit";
import { AsyncContext } from "@toolcog/util/async";
import type { EmbeddingVector, ToolSource } from "@toolcog/core";
import type { Message } from "./message.ts";

/**
 * Agent configuration options.
 *
 * Toolkits and adapters may augment this type with additional options.
 */
interface AgentConfig {}

interface AgentContextOptions extends AgentConfig {
  messages?: Message[] | undefined;
  tools?: ToolSource[] | undefined;
  queryHysteresis?: number | undefined;
  queryDecay?: number | undefined;
}

type AgentContextEvents = {
  message: [message: Message, context: AgentContext];
  useTool: [tool: ToolSource, context: AgentContext];
  spawn: [child: AgentContext, parent: AgentContext];
};

class AgentContext extends Emitter<AgentContextEvents> {
  readonly #parent: AgentContext | null;
  readonly #config: AgentConfig;
  readonly #messages: Message[];
  readonly #tools: ToolSource[];
  readonly #queryVectors: EmbeddingVector[];
  #queryHysteresis: number;
  #queryDecay: number;
  #query: string | undefined;

  constructor(
    parent: AgentContext | null = null,
    options: AgentContextOptions = {},
  ) {
    super();

    const {
      messages = [],
      tools = [],
      queryHysteresis = parent?.queryHysteresis ?? 5,
      queryDecay = parent?.queryDecay ?? 0.8,
      ...config
    } = options;

    this.#parent = parent;
    this.#config = config;
    this.#messages = messages;
    this.#tools = tools;

    this.#queryVectors = [];
    this.#queryHysteresis = queryHysteresis;
    this.#queryDecay = queryDecay;
    this.#query = undefined;
  }

  get parent(): AgentContext | null {
    return this.#parent;
  }

  get config(): AgentConfig {
    return this.#config;
  }

  get messages(): readonly Message[] {
    return this.#messages;
  }

  get tools(): readonly ToolSource[] {
    return this.#tools;
  }

  /** @internal */
  get queryVectors(): readonly EmbeddingVector[] {
    return this.#queryVectors;
  }

  /** @internal */
  get queryHysteresis(): number {
    return this.#queryHysteresis;
  }

  /** @internal */
  get queryDecay(): number {
    return this.#queryDecay;
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

  /** @internal */
  addQueryVector(queryVector: EmbeddingVector): void {
    const vectors = this.#queryVectors;
    const vectorCount = vectors.length;
    if (deepEqual(queryVector, vectors[vectorCount - 1])) {
      return;
    }

    if (vectorCount >= this.#queryHysteresis) {
      vectors.splice(0, vectorCount - this.#queryHysteresis + 1);
    }
    vectors.push(queryVector);
  }

  /** @internal */
  averageQueryVector(): EmbeddingVector {
    const vectors = this.#queryVectors;
    const vectorCount = vectors.length;
    if (vectorCount === 0) {
      throw new Error("No query vectors");
    } else if (vectorCount === 1) {
      return vectors[0]!;
    }

    const vectorDim = vectors[0]!.length;
    const decayRate = this.#queryDecay;

    const queryVector = new Float32Array(vectorDim);
    let sumOfWeights = 0;

    // Compute the weighted sum of the query vector embeddings.
    for (let i = 0; i < vectorCount; i += 1) {
      const vector = vectors[i]!;
      if (vector.length !== vectorDim) {
        throw new Error("Dimension mismatch");
      }

      const weight = Math.pow(decayRate, vectorCount - i - 1);
      sumOfWeights += weight;

      for (let j = 0; j < vectorDim; j += 1) {
        queryVector[j]! += vector[j]! * weight;
      }
    }

    // Normalize the weighted sum by the total sum of weights.
    for (let j = 0; j < vectorDim; j += 1) {
      queryVector[j]! /= sumOfWeights;
    }

    // Normalize the vector to unit length.
    const norm = Math.hypot(...queryVector);
    if (norm !== 0) {
      for (let j = 0; j < vectorDim; j += 1) {
        queryVector[j]! /= norm;
      }
    }

    return queryVector;
  }

  clear(): void {
    this.#messages.length = 0;
    this.#tools.length = 0;
    this.#queryVectors.length = 0;
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
      parent !== undefined ? parent.spawn(options) : this.create(options);
    return this.#current.run(child, func, child);
  }
}

const currentConfig = (): AgentConfig | undefined => {
  return AgentContext.get()?.config;
};

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

export type { AgentConfig, AgentContextOptions, AgentContextEvents };
export {
  AgentContext,
  currentConfig,
  currentQuery,
  currentTools,
  useTool,
  useTools,
};
