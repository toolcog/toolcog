import type { DuplexOptions } from "node:stream";
import { Duplex } from "node:stream";

/** @internal */
interface MuteStreamOptions extends DuplexOptions {
  replace?: string | undefined;
  prompt?: string | undefined;
}

/** @internal */
class MuteStream extends Duplex {
  readonly #replace: string | undefined;

  readonly #prompt: string | undefined;
  #hasControl: boolean;

  #isTTY: boolean | undefined;
  #muted: boolean;

  #src: NodeJS.ReadableStream | null;
  #dst: NodeJS.WritableStream | null;

  constructor(options?: MuteStreamOptions) {
    super(options);

    this.readable = true;
    (this as { writable: boolean }).writable = true;

    this.#replace = options?.replace;

    this.#prompt = options?.prompt;
    this.#hasControl = false;

    this.#isTTY = undefined;
    this.#muted = false;

    this.#src = null;
    this.#dst = null;

    this.addListener("pipe", (src: NodeJS.ReadableStream): void => {
      this.#src = src;
    });
  }

  get isTTY(): boolean {
    if (this.#isTTY !== undefined) {
      return this.#isTTY;
    }
    return (
      (this.#dst as Partial<NodeJS.WriteStream> | null)?.isTTY ??
      (this.#src as Partial<NodeJS.ReadStream> | null)?.isTTY ??
      false
    );
  }

  set isTTY(isTTY: boolean) {
    this.#isTTY = isTTY;
  }

  get rows(): number | undefined {
    return (this.#dst as Partial<NodeJS.WriteStream> | null)?.rows;
  }

  get columns(): number | undefined {
    return (this.#dst as Partial<NodeJS.WriteStream> | null)?.columns;
  }

  mute(): void {
    this.#muted = true;
  }

  unmute(): void {
    this.#muted = false;
  }

  override pipe<T extends NodeJS.WritableStream>(
    destination: T,
    options?: { end?: boolean | undefined },
  ): T {
    this.#dst = destination;
    return super.pipe(destination, options);
  }

  override pause(): this {
    this.#src?.pause();
    return this;
  }

  override resume(): this {
    this.#src?.resume();
    return this;
  }

  override write(
    chunk: unknown,
    encoding?: BufferEncoding,
    callback?: (error: Error | null | undefined) => void,
  ): boolean;
  override write(
    chunk: unknown,
    callback?: (error: Error | null | undefined) => void,
  ): boolean;
  override write(
    chunk: unknown,
    encodingOrCallback?:
      | BufferEncoding
      | ((error: Error | null | undefined) => void),
    callback?: (error: Error | null | undefined) => void,
  ): boolean {
    if (this.#muted) {
      if (this.#replace === undefined || this.#replace === "") {
        return true;
      }

      if (typeof chunk === "string") {
        if (/^\x1b/.exec(chunk) !== null) {
          if (this.#prompt !== undefined && chunk.startsWith(this.#prompt)) {
            chunk = chunk.slice(this.#prompt.length);
            chunk = (chunk as string).replace(/./g, this.#replace);
            chunk = this.#prompt + (chunk as string);
          }
          this.#hasControl = true;
        } else {
          if (
            this.#hasControl &&
            this.#prompt !== undefined &&
            chunk.startsWith(this.#prompt)
          ) {
            this.#hasControl = false;
            this.emit("data", this.#prompt);
            chunk = chunk.slice(this.#prompt.length);
          }
          chunk = (chunk as string).replace(/./g, this.#replace);
        }
      }
    }

    this.emit("data", chunk);

    return true;
  }

  override end(callback?: () => void): this;
  override end(chunk: unknown, callback?: () => void): this;
  override end(
    chunk: unknown,
    encoding?: BufferEncoding,
    callback?: () => void,
  ): this;
  override end(
    chunkOrCallback: unknown,
    encodingOrCallback?: BufferEncoding | (() => void),
    callback?: () => void,
  ): this {
    let chunk =
      typeof chunkOrCallback === "string" ? chunkOrCallback : undefined;

    if (this.#muted) {
      if (
        chunk !== undefined &&
        this.#replace !== undefined &&
        this.#replace.length !== 0
      ) {
        chunk = chunk.replace(/./g, this.#replace);
      } else {
        chunk = undefined;
      }
    }

    if (chunk !== undefined) {
      this.emit("data", chunk);
    }

    this.emit("end");

    return this;
  }

  /** @internal */
  override destroy(...args: unknown[]): this {
    (this.#dst as { destroy?(...args: unknown[]): void } | null)?.destroy?.(
      ...args,
    );
    (this.#src as { destroy?(...args: unknown[]): void } | null)?.destroy?.(
      ...args,
    );
    return this;
  }

  /** @internal */
  destroySoon(...args: unknown[]): this {
    (
      this.#dst as { destroySoon?(...args: unknown[]): void } | null
    )?.destroySoon?.(...args);
    (
      this.#src as { destroySoon?(...args: unknown[]): void } | null
    )?.destroySoon?.(...args);
    return this;
  }

  /** @internal */
  close(...args: unknown[]): this {
    (this.#dst as { close?(...args: unknown[]): void } | null)?.close?.(
      ...args,
    );
    (this.#src as { close?(...args: unknown[]): void } | null)?.close?.(
      ...args,
    );
    return this;
  }
}

export type { MuteStreamOptions };
export { MuteStream };
