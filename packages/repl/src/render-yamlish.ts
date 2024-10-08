import { EOL } from "node:os";
import { replaceLines } from "@toolcog/util";
import { getStringWidth, wrapText } from "@toolcog/util/tty";
import { style } from "@toolcog/util/tui";

interface YamlishTheme {
  readonly bullet: string;
  readonly heading: (text: string) => string;
  readonly undefined: (text: string) => string;
  readonly null: (text: string) => string;
  readonly boolean: (text: string) => string;
  readonly number: (text: string) => string;
  readonly identifier: (text: string) => string;
  readonly string: (text: string) => string;
  readonly key: (text: string) => string;
  readonly point: (text: string) => string;
  readonly unknown: (text: string) => string;
}

const yamlishTheme: YamlishTheme = {
  bullet: "-",
  heading: (text: string) => style.cyan("[" + text + "]"),
  undefined: style.gray,
  null: style.bold,
  boolean: style.yellow,
  number: style.yellow,
  identifier: (text: string) => text,
  string: style.green,
  key: style.gray,
  point: (text: string) => style.dim(style.bold(text)),
  unknown: style.blueBright,
};

const renderYamlish = (
  heading: string | undefined,
  value: unknown,
  theme: YamlishTheme = yamlishTheme,
  width: number = Infinity,
  depth: number = 0,
): string => {
  let output = "";

  if (heading !== undefined) {
    output += " ".repeat(depth);
    output += theme.heading(heading);
    output += EOL;
  }

  output += renderYamlishValue(value, theme, width, depth);

  return output;
};

const renderYamlishValue = (
  value: unknown,
  theme: YamlishTheme,
  width: number,
  depth: number,
  output?: string,
  listItem: boolean = false,
): string => {
  const indent = " ".repeat(depth);

  if (value === undefined) {
    if (output === undefined) {
      output = indent;
    }
    output += theme.undefined("undefined");
  } else if (value === null) {
    if (output === undefined) {
      output = indent;
    }
    output += theme.null("null");
  } else if (typeof value === "boolean") {
    if (output === undefined) {
      output = indent;
    }
    output += theme.boolean(value ? "true" : "false");
  } else if (typeof value === "number") {
    if (output === undefined) {
      output = indent;
    }
    output += theme.number(String(value));
  } else if (typeof value === "string") {
    if (output === undefined) {
      output = indent;
    }
    if (/^[^\s:\n]*$/.test(value)) {
      output += theme.identifier(value);
    } else {
      const json = JSON.stringify(value);
      if (getStringWidth(json) <= width - getStringWidth(output)) {
        output += theme.string(json);
      } else {
        output += ">";
        output += EOL;
        output += replaceLines(
          wrapText(value.replace(/\r?\n/g, "\n\n"), width - indent.length),
          (line) => indent + theme.string(line),
        );
      }
    }
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      if (output === undefined) {
        output = indent;
      }
      output += "[]";
    } else {
      if (output === undefined) {
        output = "";
      } else {
        output += EOL;
      }
      for (let i = 0; i < value.length; i += 1) {
        let line = indent;
        line += theme.point(theme.bullet);
        line += " ";
        line = renderYamlishValue(
          value[i],
          theme,
          width,
          depth + 2,
          line,
          true,
        );
        if (i !== 0) {
          output += EOL;
        }
        output += line;
      }
    }
  } else if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      if (output === undefined) {
        output = indent;
      }
      output += "{}";
    } else {
      if (output === undefined) {
        output = "";
      } else if (!listItem) {
        output += EOL;
      }
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]!;
        let line: string = i == 0 && listItem ? output : indent;
        if (/^[^\s:\n]*$/.test(key)) {
          line += theme.key(key);
        } else {
          line += theme.key(JSON.stringify(key));
        }
        line += ": ";
        line = renderYamlishValue(
          (value as Record<string, unknown>)[key],
          theme,
          width,
          depth + 2,
          line,
        );
        if (i === 0 && listItem) {
          output = line;
        } else {
          if (i !== 0) {
            output += EOL;
          }
          output += line;
        }
      }
    }
  } else {
    if (output === undefined) {
      output = indent;
    }
    output += theme.unknown(String(value));
  }

  return output;
};

export type { YamlishTheme };
export { yamlishTheme, renderYamlish };
