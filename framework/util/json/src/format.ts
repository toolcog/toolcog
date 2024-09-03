import { replaceLines } from "@toolcog/util";
import type { SchemaDefinition, Schema } from "./schema.ts";

interface FormatJsonOptions {
  indent?: number | undefined;
}

const formatJson = (
  value: unknown,
  schema?: SchemaDefinition,
  options?: FormatJsonOptions,
): string => {
  return formatJsonValue(undefined, value, schema, options, undefined);
};

const formatJsonValue = (
  key: string | undefined,
  value: unknown,
  schema: SchemaDefinition | undefined,
  options: FormatJsonOptions | undefined,
  indent: number | undefined,
): string => {
  if (indent === undefined) {
    indent = 0;
  }

  const indentation = " ".repeat(indent);

  let json = "";

  if (typeof schema === "object" && schema.description !== undefined) {
    json +=
      replaceLines(schema.description, (line) => indentation + "// " + line) +
      "\n";
  }

  json += indentation;
  if (key !== undefined) {
    json += JSON.stringify(key) + ": ";
  }

  if (
    typeof schema === "object" &&
    schema.type === "object" &&
    schema.properties !== undefined &&
    typeof value === "object" &&
    value !== null
  ) {
    json += "{";
    const keys = Object.keys(value);
    for (const key of keys) {
      json +=
        "\n" +
        formatJsonValue(
          key,
          (value as Record<string, unknown>)[key],
          schema.properties[key],
          options,
          indent + (options?.indent ?? 2),
        ) +
        ",";
    }
    json += keys.length !== 0 ? "\n" + indentation + "}" : "}";
  } else if (
    typeof schema === "object" &&
    schema.type === "array" &&
    schema.items !== undefined &&
    Array.isArray(value)
  ) {
    json += "[";
    for (let i = 0; i < value.length; i += 1) {
      json +=
        "\n" +
        formatJsonValue(
          undefined,
          (value as unknown[])[i],
          Array.isArray(schema.items) ?
            (schema.items as Schema[])[i]
          : (schema.items as Schema),
          options,
          indent + (options?.indent ?? 2),
        ) +
        ",";
    }
    json += value.length !== 0 ? "\n" + indentation + "]" : "]";
  } else {
    json += JSON.stringify(value);
  }

  return json;
};

export type { FormatJsonOptions };
export { formatJson };
