import { Emitter } from "@toolcog/util/emit";
import { AsyncContext } from "@toolcog/util/async";

/**
 * The attributes of a job.
 */
interface JobAttributes {
  readonly [name: string]: unknown;
}

/**
 * The type of output a job can produce.
 */
type JobOutputType = "text" | "markdown" | "json";

/**
 * Updatable status information for a {@link Job}.
 */
interface JobInfo {
  /**
   * The updated title of the job, if defined.
   */
  title?: string | undefined;

  /**
   * The updated output of the job, if defined.
   */
  output?: string | undefined;

  /**
   * The updated output type of the job, if defined.
   */
  outputType?: JobOutputType | undefined;

  /**
   * The updated maximum number of output characters to include before
   * ellipsizing, if defined.
   */
  ellipsize?: number | undefined;

  /**
   * The updated attributes of the job, if defined.
   */
  attributes?: JobAttributes | undefined;
}

/**
 * Events that can be emitted by a job.
 */
type JobEvents = {
  fork: [parent: Job, child: Job];
  update: [job: Job];
  finish: [job: Job];
};

/**
 * Live status information about a hierarchical task.
 */
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

  /**
   * Creates a new job.
   *
   * @param parent - The parent of the job, or `null` if this is a root job.
   * @param name - The name of the job.
   * @param info - Optional status information to associate with the job.
   */
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

  /**
   * The parent of this job, or `null` if this is a root job.
   */
  get parent(): Job | null {
    return this.#parent;
  }

  /**
   * The root ancestor of this job.
   */
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

  /**
   * The number of parents between this job and its root ancestor.
   */
  get depth(): number {
    return this.#depth;
  }

  /**
   * The number of direct children of this job.
   */
  get childCount(): number {
    return this.#childCount;
  }

  /**
   * The number of transitive descendants of this job.
   */
  get descendantCount(): number {
    return this.#descendantCount;
  }

  /**
   * The next sibling of this job, or `null` if this is the last child
   * of its parent.
   */
  get nextSibling(): Job | null {
    return this.#nextSibling;
  }

  /**
   * The previous sibling of this job, or `null` if this is the first child
   * of its parent.
   */
  get prevSibling(): Job | null {
    return this.#prevSibling;
  }

  /**
   * The first child of this job, or `null` if this job has no children.
   */
  get firstChild(): Job | null {
    return this.#firstChild;
  }

  /**
   * The last child of this job, or `null` if this job has no children.
   */
  get lastChild(): Job | null {
    return this.#lastChild;
  }

  /**
   * Iterates over the children of this job, starting at the given index.
   *
   * @param startIndex - The optional index at which to start iterating.
   * @yields The children of this job.
   */
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

  /**
   * Iterates over the descendants of this job, starting at the given index.
   *
   * @param startIndex - The optional index at which to start iterating.
   * @yields The descendants of this job.
   */
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

  /**
   * The name of this job.
   */
  get name(): string {
    return this.#name;
  }

  /**
   * The title of this job, or `undefined` if no title has been set.
   */
  get title(): string | undefined {
    return this.#title;
  }

  /**
   * The output of this job, or `undefined` if no output has been set.
   */
  get output(): string | undefined {
    return this.#output;
  }

  /**
   * The type of output for this job. Defaults to `"text"`.
   */
  get outputType(): JobOutputType {
    return this.#outputType;
  }

  /**
   * The maximum number of output characters to include before ellipsizing.
   */
  get ellipsize(): number | undefined {
    return this.#ellipsize;
  }

  /**
   * The attributes of this job.
   */
  get attributes(): JobAttributes {
    return this.#attributes;
  }

  /**
   * Whether this job has finished.
   */
  get finished(): boolean {
    return this.#finished;
  }

  /**
   * Sets an attribute of this job.
   *
   * @param name - The name of the attribute to set.
   * @param value - The value of the attribute to set.
   */
  setAttribute(name: string, value: unknown): void {
    this.#attributes[name] = value;
  }

  /**
   * Updates the status information of this job.
   *
   * @param info - The new status information to associate with this job.
   */
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

  /**
   * Marks this job as finished.
   *
   * @param info - Optional final status information to associate with this job.
   */
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

  /**
   * Creates a new child job of this job.
   *
   * @param name - The name of the new job.
   * @param info - Optional status information to associate with the new job.
   * @returns The new child job.
   */
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

  /**
   * Async local storage for the currently active job.
   */
  static readonly #current = new AsyncContext.Variable<Job>({
    name: "toolcog.job",
  });

  /**
   * Returns the job that's active for the current async context,
   * or `null` if not currently running in a job context.
   */
  static get(): Job | null {
    return Job.#current.get() ?? null;
  }

  /**
   * Runs the provided function within the context of the specified job.
   *
   * @param job - The job within which to run the function,
   * or `null` to run the function outside of any job context.
   * @param func - The function to run in the job context.
   * @param args - The arguments to pass to the function.
   * @returns The return value of the function.
   */
  static run<F extends (...args: any[]) => unknown>(
    job: Job | null | undefined,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    return this.#current.run(job ?? undefined, func, ...args);
  }

  /**
   * Returns a function in the context of a new child job of the current job.
   *
   * @param name - The name of the new job.
   * @param func - The function to run in the new job context.
   * @returns The return value of the function.
   */
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
