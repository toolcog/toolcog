import type ts from "typescript";
import { replaceLines } from "@toolcog/util";

const trimSingleLineComment = (comment: string): string => {
  // Trim leading double slashes and trailing whitespace,
  // while preserving indentation.
  return comment.replace(/\s*\/\/\s?|\s+$/g, "");
};

const trimMultiLineComment = (comment: string): string => {
  return replaceLines(
    // Trim surrounding comment and whitespace trivia.
    comment.replace(/^\s*\/\*+\s*(\r?\n)*|(\r?\n)*\s*\*+\/\s*$/g, ""),
    // Trim leading asterisks and trailing whitespace from each line,
    // while preserving indentation.
    (line) => line.replace(/^\s*\*\s?|^\s+|\s+$/g, ""),
  );
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
    if (commentRange.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
      comment = trimSingleLineComment(comment);
    } else {
      comment = trimMultiLineComment(comment);
    }

    commentText += comment;

    prevCommentRange = commentRange;
  }
  return commentText;
};

/**
 * Returns the leading comment associated with the given `node`. If the `node`
 * is not directly preceded by a comment, then the comment associated with the
 * nearest semantically transparent ancestor is returned, if one exists.
 *
 * A semantically transparent ancestor is a node, such as a return statement,
 * variable declaration, or parenthesized expression, whose comments can be
 * reasonably ascribed to the child node.
 */
const getLeadingComment = (
  ts: typeof import("typescript"),
  node: ts.Node,
): string | undefined => {
  const sourceFile = node.getSourceFile();
  const sourceText = sourceFile.getFullText();

  let comment: string | undefined;
  while (true) {
    comment = getCommentText(
      ts,
      sourceText,
      ts.getLeadingCommentRanges(sourceText, node.getFullStart()),
    );

    const parent = node.parent as ts.Node | undefined;
    if (comment !== undefined || parent === undefined) {
      break;
    }

    // Check for and search semantically transparent ancestor nodes.
    switch (parent.kind) {
      case ts.SyntaxKind.ParenthesizedExpression:
      case ts.SyntaxKind.AwaitExpression:
      case ts.SyntaxKind.AsExpression:
      case ts.SyntaxKind.NonNullExpression:
      case ts.SyntaxKind.SatisfiesExpression:
      case ts.SyntaxKind.VariableStatement:
      case ts.SyntaxKind.ExpressionStatement:
      case ts.SyntaxKind.ReturnStatement:
      case ts.SyntaxKind.VariableDeclaration:
      case ts.SyntaxKind.PropertyAssignment:
      case ts.SyntaxKind.ShorthandPropertyAssignment:
        // Comments associated with these ancestor nodes can unambiguously be
        // considered to apply to the leaf node.
        node = parent;
        continue;
      case ts.SyntaxKind.CallExpression:
        // Comments associated with call expressions can usefully be
        // considered to apply to its argument expressions.
        node = parent;
        continue;
      case ts.SyntaxKind.BinaryExpression:
        // Comments associated with assignment expression can meaningfully be
        // considered to apply to the right-hand side of the expression.
        if (
          (parent as ts.BinaryExpression).operatorToken.kind ===
          ts.SyntaxKind.EqualsToken
        ) {
          node = parent;
          continue;
        }
        break;
      case ts.SyntaxKind.VariableDeclarationList:
        // Comments associated with a variable declaration list can be
        // considered to apply to the first declaration in the list.
        if ((parent as ts.VariableDeclarationList).declarations[0] === node) {
          node = parent;
          continue;
        }
        break;
      default:
        break;
    }

    // Discontinue the search unless explicitly continued.
    break;
  }

  return comment;
};

export { getLeadingComment };
