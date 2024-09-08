import type ts from "typescript";
import { splitLines } from "@toolcog/util";
import { getLeadingComment } from "./utils/comments.ts";

interface Comment {
  description: string | undefined;
  params: Record<string, string>;
  returns: string | undefined;
  idioms: string[];
  tags: Record<string, string>;
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
  comment: Comment,
  tag: string,
  value: string,
): void => {
  if (tag === "param") {
    const [, name, description] = parseTypedValue(ts, value, { named: true });
    comment.params[name] = description;
    return;
  }

  if (tag === "returns") {
    const [, , description] = parseTypedValue(ts, value);
    comment.returns = description;
    return;
  }

  if (tag === "idiom") {
    comment.idioms.push(value);
    return;
  }

  comment.tags[tag] = value;
};

const parseComment = (
  ts: typeof import("typescript"),
  commentText: string,
): Comment => {
  const comment: Comment = {
    description: undefined,
    params: Object.create(null) as Record<string, string>,
    returns: undefined,
    idioms: [],
    tags: Object.create(null) as Record<string, string>,
  };

  let tag: string | undefined;
  let value: string | undefined;
  for (const line of splitLines(commentText)) {
    const match = /^\s*@(\w+)/.exec(line);
    if (match !== null) {
      if (tag !== undefined) {
        parseTag(ts, comment, tag, value!.trim());
      }
      tag = match[1];
      value = line.substring(match[0].length);
      continue;
    }

    if (tag === undefined) {
      if (comment.description === undefined) {
        comment.description = "";
      } else {
        comment.description += "\n";
      }
      comment.description += line;
    } else {
      value! += "\n" + line;
    }
  }

  if (tag !== undefined) {
    parseTag(ts, comment, tag, value!.trim());
  }

  return comment;
};

const mergeComments: {
  (...comments: Comment[]): Comment;
  (...comments: (Comment | undefined)[]): Comment | undefined;
} = ((...comments: (Comment | undefined)[]): Comment | undefined => {
  let defined = false;

  let description: string | undefined;
  const params = Object.create(null) as Record<string, string>;
  let returns: string | undefined;
  const idioms = new Set<string>();
  const tags = Object.create(null) as Record<string, string>;

  for (const comment of comments) {
    if (comment === undefined) {
      continue;
    }
    defined = true;

    if (comment.description !== undefined) {
      description = comment.description;
    }
    for (const key in comment.params) {
      params[key] = comment.params[key]!;
    }
    if (comment.returns !== undefined) {
      returns = comment.returns;
    }
    for (const idiom of comment.idioms) {
      idioms.add(idiom);
    }
    for (const tag in comment.tags) {
      tags[tag] = comment.tags[tag]!;
    }
  }

  if (!defined) {
    return undefined;
  }

  return {
    description,
    params,
    returns,
    idioms: [...idioms],
    tags,
  };
}) as typeof mergeComments;

const getCommentForNode = (() => {
  const commentCache = new WeakMap<ts.Node, Comment | undefined>();
  return (
    ts: typeof import("typescript"),
    node: ts.Node,
  ): Comment | undefined => {
    let comment = commentCache.get(node);
    if (comment === undefined && !commentCache.has(node)) {
      const commentText = getLeadingComment(ts, node);
      if (commentText !== undefined) {
        comment = parseComment(ts, commentText);
      }
      commentCache.set(node, comment);
    }
    return comment;
  };
})();

const getCommentForType = (
  ts: typeof import("typescript"),
  type: ts.Type,
): Comment | undefined => {
  const symbol = type.getSymbol();
  const declaration = symbol?.declarations?.[0];
  return declaration !== undefined ?
      getCommentForNode(ts, declaration)
    : undefined;
};

const getComment = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker | undefined,
  node: ts.Node,
  type?: ts.Type,
): Comment | undefined => {
  if (type === undefined) {
    type = checker?.getTypeAtLocation(node);
  }
  const symbol = checker?.getSymbolAtLocation(node);
  const declaration = symbol?.declarations?.[0];
  return mergeComments(
    type !== undefined ? getCommentForType(ts, type) : undefined,
    declaration !== undefined ? getCommentForNode(ts, declaration) : undefined,
    getCommentForNode(ts, node),
  );
};

export type { Comment };
export {
  parseComment,
  mergeComments,
  getCommentForNode,
  getCommentForType,
  getComment,
};
