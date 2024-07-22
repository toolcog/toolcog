import type ts from "typescript";

const trimMultiLineComment = (comment: string): string => {
  return comment
    .trim() // Remove leading and trailing whitespace.
    .replace(/^\/\*/, "") // Remove leading `/*`.
    .replace(/\*\/$/, "") // Remove trailing `*/`.
    .split("\n")
    .map((line) =>
      // Remove leading asterisks and trim whitespace.
      line.replace(/^\s*\*\s?/, "").trim(),
    )
    .join("\n")
    .trim();
};

const getCommentText = (
  ts: typeof import("typescript"),
  sourceText: string,
  commentRanges: readonly ts.CommentRange[] | undefined,
): string | undefined => {
  if (commentRanges === undefined) {
    return undefined;
  }

  let prevCommentRange: ts.CommentRange | undefined;
  let commentText: string | undefined;
  for (const commentRange of commentRanges) {
    if (
      commentRange.kind === ts.SyntaxKind.MultiLineCommentTrivia ||
      prevCommentRange?.kind === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      commentText = undefined;
    } else if (prevCommentRange !== undefined) {
      const newlineIndex = sourceText.indexOf("\n", prevCommentRange.end + 1);
      if (newlineIndex >= 0 && newlineIndex < commentRange.pos) {
        commentText = undefined;
      }
    }

    if (commentText === undefined) {
      commentText = "";
    } else {
      commentText += "\n";
    }

    let comment = sourceText.slice(commentRange.pos, commentRange.end);
    if (comment.startsWith("//")) {
      comment = comment.substring(2).trim();
    } else {
      comment = trimMultiLineComment(comment);
    }

    commentText += comment;

    prevCommentRange = commentRange;
  }
  return commentText;
};

/**
 * Returns the comment that precedes the given `node`. If the `expansive`
 * option is not `false`, then the leading comment of any ancestor node
 * that begins on the same line is also considered.
 */
const getLeadingComment = (
  ts: typeof import("typescript"),
  node: ts.Node,
  options?: { expansive?: boolean | undefined },
): string | undefined => {
  const sourceFile = node.getSourceFile();
  const sourceText = sourceFile.getFullText();
  const leafNode = node;

  let comment: string | undefined;
  while (true) {
    comment = getCommentText(
      ts,
      sourceText,
      ts.getLeadingCommentRanges(sourceText, node.getFullStart()),
    );

    // Expand the search to the pare node if no leading comment was found and
    // expansive search is not disabled.
    if (
      options?.expansive !== false &&
      comment === undefined &&
      (node.parent as ts.Node | undefined) !== undefined
    ) {
      // Check for newline characters between the start of ancestor node
      // and the start of the leaf node.
      const newlineIndex = sourceText.indexOf("\n", node.parent.getStart());
      if (newlineIndex < 0 || newlineIndex >= leafNode.getStart()) {
        // The ancestor node starts on the same line as the leaf node;
        // check for a leading comment on the ancestor node.
        node = node.parent;
        continue;
      }
    }
    break;
  }
  return comment;
};

export { getLeadingComment };
