import { Emitter } from "@toolcog/util/emit";
import { AsyncContext } from "@toolcog/util/async";

interface JobAttributes {
  readonly [name: string]: unknown;
}

type JobOutputType = "text" | "markdown" | "json";

interface JobInfo {
  title?: string | undefined;
  output?: string | undefined;
  outputType?: JobOutputType | undefined;
  ellipsize?: number | undefined;
  attributes?: JobAttributes | undefined;
}

type JobEvents = {
  fork: [parent: Job, child: Job];
  update: [job: Job];
  finish: [job: Job];
};

class Job extends Emitter<JobEvents> {
  readonly #parent: Job | null;
  #depth: number;
  #childCount: number;
  #descendantCount: number;

  #nextSibling: Job | null;
  #prevSibling: Job | null;
  #firstChild: Job | null;
  #lastChild: Job | null;

  readonly #name: string;
  #title: string | undefined;
  #output: string | undefined;
  #outputType: JobOutputType;
  #ellipsize: number | undefined;
  #attributes: { [name: string]: unknown };
  #finished: boolean;

  constructor(parent: Job | null, name: string, info?: JobInfo) {
    super();

    this.#parent = parent;
    this.#depth = parent !== null ? parent.#depth + 1 : 0;
    this.#childCount = 0;
    this.#descendantCount = 0;

    this.#nextSibling = null;
    this.#prevSibling = null;
    this.#firstChild = null;
    this.#lastChild = null;

    this.#name = name;
    this.#title = info?.title;
    this.#output = info?.output;
    this.#outputType = info?.outputType ?? "text";
    this.#ellipsize = info?.ellipsize;
    this.#attributes = info?.attributes ?? {};
    this.#finished = false;
  }

  get parent(): Job | null {
    return this.#parent;
  }

  get root(): Job {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let job: Job = this;
    while (true) {
      const parent = job.#parent;
      if (parent === null) {
        break;
      }
      job = parent;
    }
    return job;
  }

  get depth(): number {
    return this.#depth;
  }

  get childCount(): number {
    return this.#childCount;
  }

  get descendantCount(): number {
    return this.#descendantCount;
  }

  get nextSibling(): Job | null {
    return this.#nextSibling;
  }

  get prevSibling(): Job | null {
    return this.#prevSibling;
  }

  get firstChild(): Job | null {
    return this.#firstChild;
  }

  get lastChild(): Job | null {
    return this.#lastChild;
  }

  *children(startIndex: number = 0): Iterable<Job> {
    if (startIndex < 0) {
      throw new Error("Negative start index");
    }
    if (startIndex >= this.#childCount) {
      return;
    }

    let index = 0;
    let child = this.#firstChild;
    while (child !== null) {
      const nextChild = child.#nextSibling;

      if (index >= startIndex) {
        yield child;
      }
      index += 1;

      child = nextChild;
    }
  }

  *descendants(startIndex: number = 0): Iterable<Job> {
    if (startIndex < 0) {
      throw new Error("Negative start index");
    }
    if (startIndex >= this.#descendantCount) {
      return;
    }

    let index = 0;
    let child = this.#firstChild;
    while (child !== null) {
      const nextChild = child.#nextSibling;

      if (index >= startIndex) {
        yield child;
      }
      index += 1;

      const untilStart = Math.max(0, startIndex - index);
      if (child.#descendantCount > untilStart) {
        yield* child.descendants(untilStart);
      }
      index += child.#descendantCount - untilStart;

      child = nextChild;
    }
  }

  get name(): string {
    return this.#name;
  }

  get title(): string | undefined {
    return this.#title;
  }

  get output(): string | undefined {
    return this.#output;
  }

  get outputType(): JobOutputType {
    return this.#outputType;
  }

  get ellipsize(): number | undefined {
    return this.#ellipsize;
  }

  get attributes(): JobAttributes {
    return this.#attributes;
  }

  get finished(): boolean {
    return this.#finished;
  }

  setAttribute(name: string, value: unknown): void {
    this.#attributes[name] = value;
  }

  update(info: JobInfo): void {
    if (this.#finished) {
      return;
    }

    if ("title" in info) {
      this.#title = info.title;
    }
    if ("output" in info) {
      this.#output = info.output;
    }
    if ("outputType" in info) {
      this.#outputType = info.outputType ?? "text";
    }
    if ("ellipsize" in info) {
      this.#ellipsize = info.ellipsize;
    }
    if ("attributes" in info) {
      this.#attributes = {
        ...this.#attributes,
        ...info.attributes,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let ancestor: Job | null = this;
    do {
      ancestor.emit("update", this);
      ancestor = ancestor.#parent;
    } while (ancestor !== null);
  }

  finish(info?: JobInfo): void {
    if (this.#finished) {
      return;
    }

    if (info !== undefined) {
      this.update(info);
    }

    let child = this.#firstChild;
    while (child !== null) {
      child.finish();
      child = child.#nextSibling;
    }

    this.#finished = true;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let ancestor: Job | null = this;
    do {
      ancestor.emit("finish", this);
      ancestor = ancestor.#parent;
    } while (ancestor !== null);
  }

  fork(name: string, info?: JobInfo): Job {
    const child = new Job(this, name, info);

    if (this.#lastChild !== null) {
      this.#lastChild.#nextSibling = child;
      child.#prevSibling = this.#lastChild;
    } else {
      this.#firstChild = child;
    }
    this.#lastChild = child;

    this.#childCount += 1;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let job: Job | null = this;
    do {
      job.#descendantCount += 1;
      job = job.#parent;
    } while (job !== null);

    this.emit("fork", this, child);

    return child;
  }

  static readonly #current = new AsyncContext.Variable<Job>({
    name: "toolcog.job",
  });

  static get(): Job | null {
    return Job.#current.get() ?? null;
  }

  static run<F extends (...args: any[]) => unknown>(
    job: Job | null | undefined,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    return this.#current.run(job ?? undefined, func, ...args);
  }

  static async spawn<R>(
    name: string,
    func: (job: Job) => R,
  ): Promise<Awaited<R>> {
    const parent = Job.#current.get();
    const job = parent !== undefined ? parent.fork(name) : new Job(null, name);
    try {
      return await Promise.resolve(Job.#current.run(job, func, job));
    } finally {
      job.finish();
    }
  }
}

export type { JobAttributes, JobOutputType, JobInfo, JobEvents };
export { Job };
