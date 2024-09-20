import { Emitter } from "@toolcog/util/emit";
import { AsyncContext } from "@toolcog/util/async";
import type { EmbeddingVector, ToolSource } from "@toolcog/core";
import type { Message } from "./message.ts";

interface AgentContextOptions {
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
  readonly #messages: Message[];
  readonly #tools: ToolSource[];
  readonly #queryVectors: EmbeddingVector[];
  #queryHysteresis: number;
  #queryDecay: number;
  #query: string | undefined;

  constructor(
    parent: AgentContext | null = null,
    options?: AgentContextOptions,
  ) {
    super();

    this.#parent = parent;
    this.#messages = options?.messages ?? [];
    this.#tools = options?.tools ?? [];

    this.#queryVectors = [];
    this.#queryHysteresis =
      options?.queryHysteresis ?? parent?.queryHysteresis ?? 5;
    this.#queryDecay = options?.queryDecay ?? parent?.queryDecay ?? 0.8;
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
    const vectorCount = this.#queryVectors.length;
    if (vectorCount !== 0) {
      const lastVector = this.#queryVectors[vectorCount - 1]!;
      if (queryVector === lastVector) {
        return;
      }
      const vectorDim = lastVector.length;
      if (queryVector.length !== vectorDim) {
        throw new Error("Dimension mismatch");
      }
      let i = 0;
      while (i < vectorDim) {
        if (queryVector[i]! !== lastVector[i]!) {
          break;
        }
        i += 1;
      }
      if (i === vectorDim) {
        return;
      }
    }

    if (vectorCount >= this.#queryHysteresis) {
      this.#queryVectors.splice(0, vectorCount - this.#queryHysteresis + 1);
    }
    this.#queryVectors.push(queryVector);
  }

  /** @internal */
  decayedQueryVector(): EmbeddingVector {
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
