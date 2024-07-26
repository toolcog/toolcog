import type ts from "typescript";
import { splitLines } from "@toolcog/util";
import { getLeadingComment } from "./utils/comments.ts";

interface ToolComment {
  description: string | undefined;
  params: Map<string, string>;
  returns: string | undefined;
  tags: Map<string, string>;
}

const parseTypedValue: {
  (
    ts: typeof import("typescript"),
    input: string,
  ): [type: string | undefined, name: string | undefined, description: string];
  (
    ts: typeof import("typescript"),
    input: string,
    options: { named: true },
  ): [type: string | undefined, name: string, description: string];
} = ((
  ts: typeof import("typescript"),
  input: string,
  options?: { named?: true },
): [
  type: string | undefined,
  name: string | undefined,
  description: string,
] => {
  let balance = 0;
  let index = 0;

  while (index < input.length) {
    if (input.charCodeAt(index) === 0x7b /*'{'*/) {
      balance += 1;
    } else if (input.charCodeAt(index) === 0x7d /*'}'*/) {
      balance -= 1;
    }
    if (balance === 0) {
      break;
    }
    index += 1;
  }

  if (balance !== 0) {
    // Return unclosed input in description.
    return [undefined, undefined, input];
  }

  let type: string | undefined;
  if (index !== 0) {
    // Exclude the outermost curly braces from the type string.
    type = input.slice(1, index);
    // Consume the final closing curly brace.
    index += 1;
  }

  let name: string | undefined;
  if (options?.named === true) {
    const nameStart = index;
    if (
      index < input.length &&
      ts.isIdentifierStart(input.charCodeAt(index), ts.ScriptTarget.ESNext)
    ) {
      index += 1;
      while (
        index < input.length &&
        ts.isIdentifierPart(input.charCodeAt(index), ts.ScriptTarget.ESNext)
      ) {
        index += 1;
      }
    }
    name = input.slice(nameStart, index);

    while (index < input.length && input.charCodeAt(index) === 0x20 /*' '*/) {
      index += 1;
    }
    if (index < input.length && input.charCodeAt(index) === 0x2d /*'-'*/) {
      index += 1;
    }
    while (index < input.length && input.charCodeAt(index) === 0x20 /*' '*/) {
      index += 1;
    }
  }

  const description = input.slice(index).trim();

  return [type, name, description];
}) as typeof parseTypedValue;

const parseTag = (
  ts: typeof import("typescript"),
  toolComment: ToolComment,
  tag: string,
  value: string,
): void => {
  if (tag === "param") {
    const [, name, description] = parseTypedValue(ts, value, { named: true });
    toolComment.params.set(name, description);
    return;
  }

  if (tag === "returns") {
    const [, , description] = parseTypedValue(ts, value);
    toolComment.returns = description;
    return;
  }

  toolComment.tags.set(tag, value);
};

const parseToolComment = (
  ts: typeof import("typescript"),
  comment: string,
): ToolComment => {
  const toolComment: ToolComment = {
    description: undefined,
    params: new Map<string, string>(),
    returns: undefined,
    tags: new Map<string, string>(),
  };

  let tag: string | undefined;
  let value: string | undefined;
  for (const line of splitLines(comment)) {
    const match = line.match(/^\s*@(\w+)/);
    if (match !== null) {
      if (tag !== undefined) {
        parseTag(ts, toolComment, tag, value!.trim());
      }
      tag = match[1];
      value = line.substring(match[0].length);
      continue;
    }

    if (tag === undefined) {
      if (toolComment.description === undefined) {
        toolComment.description = "";
      } else {
        toolComment.description += "\n";
      }
      toolComment.description += line;
    } else {
      value! += "\n" + line;
    }
  }

  if (tag !== undefined) {
    parseTag(ts, toolComment, tag, value!.trim());
  }

  return toolComment;
};

const parseToolCommentForNode = (
  ts: typeof import("typescript"),
  node: ts.Node,
): ToolComment | undefined => {
  const comment = getLeadingComment(ts, node);
  return comment !== undefined ? parseToolComment(ts, comment) : undefined;
};

const getToolComment = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  node: ts.Node,
): ToolComment | undefined => {
  let comment = parseToolCommentForNode(ts, node);

  const type = checker.getTypeAtLocation(node);
  const typeSymbol = type.getSymbol();
  if (typeSymbol !== undefined) {
    const typeDeclaration = typeSymbol.declarations?.[0];
    if (typeDeclaration !== undefined) {
      const typeComment = parseToolCommentForNode(ts, typeDeclaration);
      comment = mergeToolComments(typeComment, comment);
    }
  }

  return comment;
};

const mergeToolComments: {
  (...toolComments: ToolComment[]): ToolComment;
  (...toolComments: (ToolComment | undefined)[]): ToolComment | undefined;
} = ((
  ...toolComments: (ToolComment | undefined)[]
): ToolComment | undefined => {
  let description: string | undefined;
  const params = new Map<string, string>();
  let returns: string | undefined;
  const tags = new Map<string, string>();
  let defined = false;

  for (const toolComment of toolComments) {
    if (toolComment === undefined) {
      continue;
    }
    defined = true;

    if (toolComment.description !== undefined) {
      description = toolComment.description;
    }
    for (const [key, value] of toolComment.params) {
      params.set(key, value);
    }
    if (toolComment.returns !== undefined) {
      returns = toolComment.returns;
    }
    for (const [tag, value] of toolComment.tags) {
      tags.set(tag, value);
    }
  }

  if (!defined) {
    return undefined;
  }

  return { description, params, returns, tags };
}) as typeof mergeToolComments;

export type { ToolComment };
export {
  parseToolComment,
  parseToolCommentForNode,
  getToolComment,
  mergeToolComments,
};
