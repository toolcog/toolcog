import type ts from "typescript";
import type { ToolcogHost } from "./host.ts";
import { getLeadingComment } from "./utils/comments.ts";

interface DocComment {
  description: string | undefined;
  params: Map<string, string>;
  returns: string | undefined;
  tags: Map<string, string>;
}

const parseDocComment = (comment: string): DocComment => {
  let description: string | undefined;
  const params = new Map<string, string>();
  let returns: string | undefined;
  const tags = new Map<string, string>();

  const setTag = (tag: string, value: string): void => {
    value = value.trim();
    let spaceIndex: number;
    if (tag === "param" && (spaceIndex = value.indexOf(" ")) > 0) {
      params.set(
        value.substring(0, spaceIndex),
        value.substring(spaceIndex + 1),
      );
    } else if (tag === "returns") {
      returns = value;
    } else {
      tags.set(tag, value);
    }
  };

  const lines = comment.split("\n");
  let tag: string | undefined;
  let value: string | undefined;
  for (let line of lines) {
    line = line.trim();
    const match = line.match(/^@(\w+)/);
    if (match !== null) {
      if (tag !== undefined) {
        setTag(tag, value!);
      }
      tag = match[1];
      value = line.substring(match[0].length).trim();
    } else {
      if (tag === undefined) {
        if (description === undefined) {
          description = "";
        } else {
          description += "\n";
        }
        description += line;
      } else {
        value! += "\n" + line;
      }
    }
  }

  if (tag !== undefined) {
    setTag(tag, value!);
  }

  return { description, params, returns, tags };
};

const parseDocCommentNode = (
  host: ToolcogHost,
  node: ts.Node,
  options?: { expansive?: boolean | undefined },
): DocComment | undefined => {
  const comment = getLeadingComment(host, node, options);
  return comment !== undefined ? parseDocComment(comment) : undefined;
};

const getDocComment = (
  host: ToolcogHost,
  node: ts.Node,
  options?: { expansive?: boolean | undefined },
): DocComment | undefined => {
  let comment = parseDocCommentNode(host, node, options);

  const type = host.checker.getTypeAtLocation(node);
  const typeSymbol = type.getSymbol();
  if (typeSymbol !== undefined) {
    const typeDeclaration = typeSymbol.declarations?.[0];
    if (typeDeclaration !== undefined) {
      const typeComment = parseDocCommentNode(host, typeDeclaration, options);
      comment = mergeDocComments(typeComment, comment);
    }
  }

  return comment;
};

const mergeDocComments: {
  (...docComments: DocComment[]): DocComment;
  (...docComments: (DocComment | undefined)[]): DocComment | undefined;
} = ((...docComments: (DocComment | undefined)[]): DocComment | undefined => {
  let description: string | undefined;
  const params = new Map<string, string>();
  let returns: string | undefined;
  const tags = new Map<string, string>();
  let defined = false;

  for (const docComment of docComments) {
    if (docComment === undefined) {
      continue;
    }
    defined = true;

    if (docComment.description !== undefined) {
      description = docComment.description;
    }
    for (const [key, value] of docComment.params) {
      params.set(key, value);
    }
    if (docComment.returns !== undefined) {
      returns = docComment.returns;
    }
    for (const [tag, value] of docComment.tags) {
      tags.set(tag, value);
    }
  }

  if (!defined) {
    return undefined;
  }

  return { description, params, returns, tags };
}) as typeof mergeDocComments;

export type { DocComment };
export {
  parseDocComment,
  parseDocCommentNode,
  getDocComment,
  mergeDocComments,
};
