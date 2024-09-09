import { EOL } from "node:os";
import type { MarkedToken, Token, Tokens, Links } from "marked";
import { replaceLines } from "@toolcog/util";
import { wrapText } from "@toolcog/util/tty";
import { link } from "@toolcog/util/tty";
import { style } from "@toolcog/util/tui";

interface MarkdownTheme {
  readonly sectionBreak: string;
  readonly bullet: string;
  readonly hr: (text: string) => string;
  readonly h1: (text: string) => string;
  readonly h2: (text: string) => string;
  readonly h3: (text: string) => string;
  readonly h4: (text: string) => string;
  readonly h5: (text: string) => string;
  readonly h6: (text: string) => string;
  readonly code: (text: string) => string;
  readonly blockquote: (text: string) => string;
  readonly point: (text: string) => string;
  readonly checkbox: (checked: boolean) => string;
  readonly html: (text: string) => string;
  readonly paragraph: (text: string) => string;
  readonly strong: (text: string) => string;
  readonly em: (text: string) => string;
  readonly codespan: (text: string) => string;
  readonly del: (text: string) => string;
  readonly url: (text: string) => string;
  readonly link: (text: string, url: string, title?: string) => string;
  readonly image: (text: string, url: string, title?: string) => string;
  readonly linkDef: (label: string, url: string) => string;
  readonly text: (text: string) => string;
}

const markdownTheme: MarkdownTheme = {
  sectionBreak: EOL + EOL,
  bullet: "-",
  hr: style.dim,
  h1: (text: string) =>
    style.magentaBright(style.bold("# " + style.underline(text))),
  h2: (text: string) =>
    style.magenta(style.bold("## " + style.underline(text))),
  h3: (text: string) => style.magenta(style.bold("### " + text)),
  h4: (text: string) => style.gray(style.bold("#### " + text)),
  h5: (text: string) => style.dim(style.bold("##### " + text)),
  h6: (text: string) => style.dim(style.bold("###### " + style.italic(text))),
  code: style.yellow,
  blockquote: (text: string) => style.gray(style.italic(text)),
  point: (text: string) => style.dim(style.bold(text)),
  checkbox: (checked: boolean) => style.cyan(checked ? "[X]" : "[ ]"),
  html: style.gray,
  paragraph: (text: string) => text,
  strong: (text: string) => style.bold("**" + text + "**"),
  em: (text: string) => style.italic("*" + text + "*"),
  codespan: (text: string) => style.yellow("`" + text + "`"),
  del: (text: string) => style.red("~~" + style.strikethrough(text) + "~~"),
  url: (url: string) => "<" + link(style.blue(style.underline(url)), url) + ">",
  link: (text: string, url: string, title?: string) =>
    link(
      "[" +
        style.whiteBright(text) +
        "](" +
        style.blue(style.underline(url)) +
        (title !== undefined ? " " + JSON.stringify(title) : "") +
        ")",
      url,
    ),
  image: (text: string, url: string, title?: string) =>
    link(
      "![" +
        style.whiteBright(text) +
        "](" +
        style.blue(style.underline(url)) +
        (title !== undefined ? " " + JSON.stringify(title) : "") +
        ")",
      url,
    ),
  linkDef: (label: string, url: string) =>
    "[" +
    style.whiteBright(label) +
    "]: " +
    link(style.blue(style.underline(url)), url),
  text: (text: string) => text,
};

const renderMarkdown = (
  tokens: Token[] & { links?: Links },
  theme: MarkdownTheme = markdownTheme,
  width: number = Infinity,
  depth: number = 0,
  top: boolean = true,
): string => {
  let output = "";
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] as MarkedToken;
    if (token.type === "space") {
      output += token.raw;
    } else if (token.type === "hr") {
      if (i !== 0 && !output.endsWith("\n")) {
        output += EOL;
      }
      output += renderMarkdownHr(token, theme, width, depth);
    } else if (token.type === "heading") {
      if (i !== 0 && !output.endsWith("\n")) {
        output += EOL;
      }
      output += renderMarkdownHeading(token, theme, width, depth);
      output += theme.sectionBreak;
    } else if (token.type === "code") {
      if (i !== 0 && !output.endsWith("\n")) {
        output += EOL;
      }
      output += renderMarkdownCode(token, theme, width, depth);
      if (top && token.codeBlockStyle === "indented") {
        output += theme.sectionBreak;
      }
    } else if (token.type === "table") {
      if (i !== 0 && !output.endsWith("\n")) {
        output += EOL;
      }
      output += renderMarkdownTable(token, theme, width, depth);
      output += EOL;
    } else if (token.type === "blockquote") {
      if (i !== 0 && !output.endsWith("\n")) {
        output += EOL;
      }
      output += renderMarkdownBlockquote(token, theme, width, depth);
    } else if (token.type === "list") {
      const prevType = tokens[i - 1]?.type;
      if (prevType !== undefined) {
        if (prevType === "text") {
          output += EOL;
        } else if (prevType !== "heading" && prevType !== "space") {
          output += theme.sectionBreak;
        }
      }
      output += renderMarkdownList(token, theme, width, depth);
    } else if (token.type === "html") {
      if (i !== 0 && !output.endsWith("\n")) {
        output += EOL;
      }
      output += renderMarkdownHtml(token, theme, width, depth);
    } else if (token.type === "paragraph") {
      if (i !== 0 && !output.endsWith("\n")) {
        output += EOL;
      }
      output += renderMarkdownParagraph(token, theme, width, depth);
    } else if (token.type === "text") {
      let text: string;
      if ("tokens" in token) {
        text = reflow(renderMarkdownInline(token.tokens, theme));
      } else {
        text = reflow(unescape(token.text));
      }
      while (true) {
        const nextToken = tokens[i + 1] as MarkedToken | undefined;
        if (nextToken?.type === "text") {
          if ("tokens" in nextToken) {
            text += reflow(renderMarkdownInline(nextToken.tokens, theme));
          } else {
            text += reflow(unescape(nextToken.text));
          }
        } else if (nextToken?.type === "space") {
          text += nextToken.raw;
        } else {
          break;
        }
        i += 1;
      }
      const indent = " ".repeat(depth);
      if (i !== 0 && !output.endsWith("\n")) {
        output += EOL;
      }
      output += replaceLines(
        wrapText(text, width - indent.length),
        (line) => indent + theme.text(line),
      );
    } else {
      throw new Error("Unexpected token " + JSON.stringify(token.type));
    }
  }

  if (tokens.links !== undefined) {
    for (const label in tokens.links) {
      const link = tokens.links[label]!;
      output += theme.linkDef(label, link.href) + EOL;
    }
  }

  return output;
};

const renderMarkdownHeading = (
  token: Tokens.Heading,
  theme: MarkdownTheme,
  width: number,
  depth: number,
): string => {
  let heading: (text: string) => string;
  if (token.depth === 1) {
    heading = theme.h1;
  } else if (token.depth === 2) {
    heading = theme.h2;
  } else if (token.depth === 3) {
    heading = theme.h3;
  } else if (token.depth === 4) {
    heading = theme.h4;
  } else if (token.depth === 5) {
    heading = theme.h5;
  } else {
    heading = theme.h6;
  }
  const text = renderMarkdownInline(token.tokens, theme);
  const indent = " ".repeat(depth);
  return replaceLines(
    wrapText(reflow(text), width - indent.length),
    (line) => indent + heading(line),
  );
};

const renderMarkdownHr = (
  token: Tokens.Hr,
  theme: MarkdownTheme,
  width: number,
  depth: number,
): string => {
  const indent = " ".repeat(depth);
  return indent + theme.hr("-".repeat(width - indent.length));
};

const renderMarkdownCode = (
  token: Tokens.Code,
  theme: MarkdownTheme,
  width: number,
  depth: number,
): string => {
  if (token.codeBlockStyle === "indented") {
    const indent = " ".repeat(depth + 4);
    return replaceLines(token.text, (line) => indent + theme.code(line));
  }

  const indent = " ".repeat(depth);
  let output = indent + theme.code("```" + (token.lang ?? "")) + EOL;
  output += replaceLines(token.text, (line) => indent + theme.code(line));
  output += EOL + indent + theme.code("```");
  return output;
};

const renderMarkdownTable = (
  token: Tokens.Table,
  theme: MarkdownTheme,
  width: number,
  depth: number,
): string => {
  const indent = " ".repeat(depth);
  return replaceLines(unescape(token.raw), (line) => indent + line);
};

const renderMarkdownBlockquote = (
  token: Tokens.Blockquote,
  theme: MarkdownTheme,
  width: number,
  depth: number,
): string => {
  const text = renderMarkdown(token.tokens, theme, width - depth - 2, 0, false);
  const indent = " ".repeat(depth);
  return replaceLines(text, (line) => indent + theme.blockquote("> " + line));
};

const renderMarkdownList = (
  token: Tokens.List,
  theme: MarkdownTheme,
  width: number,
  depth: number,
): string => {
  let output = "";

  let ordinal = typeof token.start === "number" ? token.start : 1;
  const maxOrdinal = ordinal + (token.items.length - 1);

  const indent = " ".repeat(depth);
  const pad =
    (token.ordered ? (maxOrdinal + ".").length : theme.bullet.length) + 1;

  for (let i = 0; i < token.items.length; i += 1) {
    const item = token.items[i]!;
    const bullet = token.ordered ? ordinal + "." : theme.bullet;

    if (item.task) {
      const checkbox = theme.checkbox(item.checked ?? false) + " ";
      const token0 = item.tokens[0];
      if (token0?.type === "paragraph") {
        token0.text = checkbox + token0.text;
        const token00 = token0.tokens?.[0];
        if (token00?.type === "text") {
          token00.text = checkbox + token00.text;
        }
      } else {
        item.tokens.unshift({
          type: "text",
          raw: checkbox,
          text: checkbox,
        });
      }
    }

    if (i !== 0) {
      output += EOL;
      if (item.loose) {
        output += EOL;
      }
    }

    const text = renderMarkdown(item.tokens, theme, width, depth + pad, false);

    output +=
      indent +
      theme.point(bullet) +
      " ".repeat(pad - bullet.length) +
      text.trimStart();

    ordinal += 1;
  }

  return output;
};

const renderMarkdownHtml = (
  token: Tokens.HTML | Tokens.Tag,
  theme: MarkdownTheme,
  width: number,
  depth: number,
): string => {
  const indent = " ".repeat(depth);
  return replaceLines(
    wrapText(token.text, width - indent.length),
    (line) => indent + theme.html(line),
  );
};

const renderMarkdownParagraph = (
  token: Tokens.Paragraph,
  theme: MarkdownTheme,
  width: number,
  depth: number,
): string => {
  const text = renderMarkdownInline(token.tokens, theme);
  const indent = " ".repeat(depth);
  return replaceLines(
    wrapText(reflow(text), width - indent.length),
    (line) => indent + theme.paragraph(line),
  );
};

const renderMarkdownInline = (
  tokens: Token[],
  theme: MarkdownTheme,
): string => {
  let output = "";
  for (const token of tokens as MarkedToken[]) {
    if (token.type === "escape") {
      output += token.text;
    } else if (token.type === "html") {
      output += theme.html(token.text);
    } else if (token.type === "link") {
      if (token.text === token.href && typeof token.title !== "string") {
        output += theme.url(token.href);
      } else {
        const text = renderMarkdownInline(token.tokens, theme);
        output += theme.link(
          text,
          token.href,
          typeof token.title === "string" ? unescape(token.title) : undefined,
        );
      }
    } else if (token.type === "image") {
      output += theme.image(
        unescape(token.text),
        token.href,
        typeof token.title === "string" ? unescape(token.title) : undefined,
      );
    } else if (token.type === "strong") {
      const text = renderMarkdownInline(token.tokens, theme);
      output += theme.strong(text);
    } else if (token.type === "em") {
      const text = renderMarkdownInline(token.tokens, theme);
      output += theme.em(text);
    } else if (token.type === "codespan") {
      output += theme.codespan(unescape(token.text));
    } else if (token.type === "br") {
      output += EOL;
    } else if (token.type === "del") {
      const text = renderMarkdownInline(token.tokens, theme);
      output += theme.del(text);
    } else if (token.type === "text") {
      output += theme.text(unescape(token.text));
    } else {
      throw new Error("Unexpected token " + JSON.stringify(token.type));
    }
  }
  return output;
};

const reflow = (text: string): string => {
  return text.replace(/\r?\n(?!\s)/g, " ");
};

const unescape = (text: string): string => {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
};

export type { MarkdownTheme };
export { markdownTheme, renderMarkdown, renderMarkdownInline };
