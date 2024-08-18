import { EOL } from "node:os";
import type { Key, Interface, CursorPos } from "node:readline";
import { createInterface, clearLine } from "node:readline";
import { countLines, getLastLine } from "@toolcog/util";
import type { Style } from "@toolcog/util/tty";
import {
  stylize,
  stripAnsi,
  cursorTo,
  cursorUp,
  cursorDown,
  cursorShow,
  eraseLines,
  wrapText,
  MuteStream,
} from "@toolcog/util/tty";

interface ViewOptions {
  input?: NodeJS.ReadableStream | undefined;
  output?: NodeJS.WritableStream | undefined;
  readline?: Interface | undefined;
  styled?: boolean | undefined;
}

class View {
  readonly #input: NodeJS.ReadableStream;
  readonly #output: MuteStream;

  readonly #readline: Interface;
  readonly #standalone: boolean;

  readonly #styled: boolean;
  readonly #style: Style;

  #promptLine: string;
  #cursor: CursorPos;
  #height: number;
  #bottom: number;
  #hidden: boolean;

  constructor(options?: ViewOptions) {
    this.#input = options?.input ?? process.stdin;
    if (options?.output instanceof MuteStream) {
      this.#output = options.output;
    } else {
      this.#output = new MuteStream();
      this.#output.pipe(options?.output ?? process.stdout);
    }

    this.#readline =
      options?.readline ??
      createInterface({
        input: this.#input,
        output: this.#output,
        terminal: true,
      });
    this.#standalone = options?.readline === undefined;

    this.#styled = options?.styled ?? true;
    this.#style = stylize(this.#styled);

    this.#promptLine = "";
    this.#cursor = this.#readline.getCursorPos();
    this.#height = 0;
    this.#bottom = 0;
    this.#hidden = false;
  }

  get input(): NodeJS.ReadableStream {
    return this.#input;
  }

  get output(): MuteStream {
    return this.#output;
  }

  get rows(): number | undefined {
    return this.#output.rows;
  }

  get columns(): number {
    return this.#output.columns ?? 80;
  }

  get readline(): Interface {
    return this.#readline;
  }

  get line(): string {
    return this.#readline.line;
  }

  set line(line: string) {
    (this.#readline as { line: string }).line = line;
  }

  get styled(): boolean {
    return this.#styled;
  }

  get style(): Style {
    return this.#style;
  }

  get hidden(): boolean {
    return this.#hidden;
  }

  hide(): void {
    if (this.#hidden) {
      return;
    }

    this.clean();
    this.#promptLine = "";
    this.#height = 0;
    this.#bottom = 0;

    this.#output.unmute();
    this.#output.write(cursorShow);
    this.#output.mute();

    this.#hidden = true;
  }

  show(): void {
    if (!this.#hidden) {
      return;
    }

    this.#hidden = false;

    this.#output.unmute();
    this.#readline.prompt();
    this.#output.mute();

    this.updateCursor();
  }

  render(
    content: string,
    bottomContent?: string,
    consoleCalls?: (() => void)[],
  ): void {
    if (this.#hidden) {
      return;
    }

    const promptLine = stripAnsi(getLastLine(content));

    // Remove readline.line from the prompt.
    let prompt = promptLine;
    if (this.#readline.line.length !== 0) {
      prompt = prompt.slice(0, -this.#readline.line.length);
    }

    // Use the last content line as the prompt to control backspace.
    this.#readline.setPrompt(prompt);

    // Get the current cursor position, which setPrompt just changed.
    this.#cursor = this.#readline.getCursorPos();

    // Word wrap the content to fit the terminal width.
    const maxWidth = this.columns;
    content = wrapText(content, maxWidth);
    if (bottomContent !== undefined) {
      bottomContent = wrapText(bottomContent, maxWidth);
    }

    // Insert a newline if the prompt exactly fills a line to prevent
    // the cursor from appearing at the beginning of the current line.
    if (promptLine.length !== 0 && promptLine.length % maxWidth === 0) {
      content += EOL;
    }

    // Assemble the output to write to the screen.
    let output = content;
    if (bottomContent !== undefined) {
      output += EOL + bottomContent;
    }

    // Treat the parts of the prompt under the cursor as part of the
    // bottom content in order to correctly cleanup and re-render.
    const bottomHeight =
      Math.floor(promptLine.length / maxWidth) -
      this.#cursor.rows +
      (bottomContent !== undefined ? countLines(bottomContent) : 0);

    if (bottomHeight !== 0) {
      // Return the cursor to the input position on top of the bottom content.
      output += cursorUp(bottomHeight);
    }

    // Return cursor to the initial left offset.
    output += cursorTo(this.#cursor.cols);

    this.clean();

    if (consoleCalls !== undefined && consoleCalls.length !== 0) {
      for (const consoleCall of consoleCalls) {
        consoleCall();
      }
      consoleCalls.length = 0;
    }

    this.#promptLine = promptLine;
    this.#height = countLines(output);
    this.#bottom = bottomHeight;

    this.#output.unmute();
    this.#output.write(output);
    this.#output.mute();
  }

  updateCursor(): void {
    if (this.#hidden) {
      return;
    }

    const cursor = this.#readline.getCursorPos();
    if (cursor.cols !== this.#cursor.cols) {
      this.#output.unmute();
      this.#output.write(cursorTo(cursor.cols));
      this.#output.mute();
      this.#cursor = cursor;
    }
  }

  clean(): void {
    if (this.#hidden) {
      return;
    }

    this.#output.unmute();
    if (this.#bottom !== 0) {
      // Move the cursor to the end of the previously displayed content.
      this.#output.write(cursorDown(this.#bottom));
    }
    this.#output.write(eraseLines(this.#height));
    this.#bottom = 0;
    this.#output.mute();
  }

  clearContent(): void {
    if (this.#hidden) {
      return;
    }

    this.#output.unmute();
    if (this.#bottom !== 0) {
      // Move the cursor to the end of the previously displayed content.
      this.#output.write(cursorDown(this.#bottom));
    }
    if (this.#promptLine.length !== 0) {
      this.#output.write(EOL);
    }
    this.#output.mute();
  }

  clearLine(dir: 0 | 1 | -1): void {
    if (this.#hidden) {
      return;
    }

    this.#output.unmute();
    clearLine(this.#output, dir);
    this.#output.mute();
  }

  write(data: Buffer | string, key?: Key): void;
  write(data: Buffer | string | null | undefined, key: Key): void;
  write(data: Buffer | string | null | undefined, key?: Key): void {
    if (this.#hidden) {
      return;
    }
    this.#readline.write(data, key!);
  }

  close(): void {
    if (!this.#hidden) {
      this.#output.unmute();
      this.#readline.setPrompt("");
      this.#output.write(cursorShow);
    }
    if (this.#standalone) {
      this.#readline.close();
    }
  }
}

export type { ViewOptions };
export { View };
