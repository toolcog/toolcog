import { EOL } from "node:os";
import { throttle } from "@toolcog/util/timer";
import {
  getStringWidth,
  getLastNonEmptyLine,
  ellipsize,
  queryCursorPosition,
} from "@toolcog/util/tty";
import { Job } from "@toolcog/runtime";

class JobReporter {
  readonly #root: Job;

  readonly #input: NodeJS.ReadableStream;
  readonly #output: NodeJS.WritableStream;

  #running: Promise<void> | null;
  #resolve: (() => void) | null;
  //#reject: ((reason?: unknown) => void) | null;

  #jobCount: number;

  constructor(
    root: Job,
    input: NodeJS.ReadableStream,
    output: NodeJS.WritableStream,
  ) {
    this.#root = root;

    this.#input = input;
    this.#output = output;

    this.#running = null;
    this.#resolve = null;
    //this.#reject = null;

    this.#jobCount = 0;
  }

  get root(): Job {
    return this.#root;
  }

  get input(): NodeJS.ReadableStream {
    return this.#input;
  }

  get output(): NodeJS.WritableStream {
    return this.#output;
  }

  async start(): Promise<void> {
    if (this.#running === null) {
      this.#running = new Promise((resolve, reject) => {
        this.#resolve = resolve;
        //this.#reject = reject;
      });

      this.#root.addListener("update", this.#update);
      this.#root.addListener("finish", this.#update);
    }
    return this.#running;
  }

  readonly #update = throttle(async (job: Job) => {
    if (
      this.#root.childCount !== 0 &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
      (this.#input as NodeJS.ReadStream).isTTY === true &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
      (this.#output as NodeJS.WriteStream).isTTY === true
    ) {
      await this.#render(
        this.#input as NodeJS.ReadStream,
        this.#output as NodeJS.WriteStream,
      );
    }

    if (this.#root.finished && this.#running !== null) {
      void this.#update.force();

      const resolve = this.#resolve!;
      this.#running = null;
      this.#resolve = null;
      //this.#reject = null;
      resolve();
    }
  }, 16);

  async #render(
    input: NodeJS.ReadStream,
    output: NodeJS.WriteStream,
  ): Promise<void> {
    const outputCols = output.columns;
    const outputRows = output.rows;
    const initialPosition = await queryCursorPosition(input);
    const initialRow = initialPosition?.row ?? 0;

    output.cursorTo(0, initialRow - this.#jobCount - 1);

    // Render up to the last `outputRows` jobs, excluding the root job.
    let jobIndex = Math.max(0, this.#root.descendantCount - outputRows);
    let jobCount = 0;
    for (const job of this.#root.descendants(jobIndex)) {
      output.write(this.#getStatusLine(job, outputCols - 1));
      output.clearLine(1);
      output.write(EOL);

      jobIndex += 1;
      jobCount += 1;
    }

    this.#jobCount = jobCount;
  }

  #getStatusLine(job: Job, maxWidth: number): string {
    let line = "";

    if (job.parent !== null) {
      const appendPrefix = (ancestor: Job): void => {
        if (ancestor.parent === null) {
          return;
        }
        appendPrefix(ancestor.parent);
        if (ancestor.nextSibling !== null) {
          line += "│ ";
        } else {
          line += "  ";
        }
      };
      appendPrefix(job.parent);
    }

    if (job.nextSibling !== null) {
      line += "├─";
    } else {
      line += "└─";
    }
    line += (job.icon ?? "─") + "─";

    if (job.title !== undefined) {
      line += " " + job.title;
    }

    if (job.status !== undefined) {
      if (job.title !== undefined) {
        line += ":";
      }
      line += " ";
      line += ellipsize(
        getLastNonEmptyLine(job.status),
        maxWidth - getStringWidth(line),
        job.ellipsize,
      );
    }

    return line;
  }
}

export { JobReporter };
