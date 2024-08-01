import {
  relative as relativePath,
  parse as parsePath,
  format as formatPath,
} from "node:path";
import type ts from "typescript";

interface NodeIdOptions {
  package?: boolean | undefined;
  module?: boolean | undefined;

  getCommonSourceDirectory?: (() => string) | undefined;
}

const getNodeId = (
  ts: typeof import("typescript"),
  node: ts.Node | undefined,
  options?: NodeIdOptions,
): string | undefined => {
  if (node === undefined) {
    return undefined;
  }

  if (ts.isSourceFile(node)) {
    let packageName: string | undefined;
    if (options?.package === true) {
      packageName = node.packageJsonScope?.contents.packageJsonContent.name;
    }

    let moduleName: string | undefined;
    if (
      options?.module === true &&
      options.getCommonSourceDirectory !== undefined
    ) {
      const { dir, name } = parsePath(
        relativePath(options.getCommonSourceDirectory(), node.fileName),
      );
      moduleName = formatPath({ dir, name }).replace("\\", "/");
    }

    if (packageName !== undefined && moduleName !== undefined) {
      return packageName + "/" + moduleName + ":";
    } else if (packageName !== undefined) {
      return packageName + ":";
    } else if (moduleName !== undefined) {
      return moduleName + ":";
    } else {
      return undefined;
    }
  }

  let name: ts.Node;
  if (ts.isDeclaration(node)) {
    name = ts.getNameOfDeclaration(node) ?? node;
  } else {
    name = node;
  }

  let nodeId = getNodeId(ts, node.parent, options);

  let keyword: string | undefined;
  switch (name.kind) {
    case ts.SyntaxKind.NumericLiteral:
      if (nodeId === undefined) {
        nodeId = "";
      }
      nodeId += "[" + (name as ts.NumericLiteral).text + "]";
      break;
    case ts.SyntaxKind.StringLiteral:
      if (nodeId === undefined) {
        nodeId = "";
      }
      nodeId += "[" + JSON.stringify((name as ts.StringLiteral).text) + "]";
      break;
    case ts.SyntaxKind.Identifier:
    case ts.SyntaxKind.PrivateIdentifier:
      if (nodeId === undefined) {
        nodeId = "";
      } else if (!nodeId.endsWith(":")) {
        nodeId += ".";
      }
      nodeId += (name as ts.Identifier | ts.PrivateIdentifier).text;
      break;
    case ts.SyntaxKind.FalseKeyword:
      keyword = "false";
      break;
    case ts.SyntaxKind.NullKeyword:
      keyword = "null";
      break;
    case ts.SyntaxKind.TrueKeyword:
      keyword = "true";
      break;
    case ts.SyntaxKind.UndefinedKeyword:
      keyword = "undefined";
      break;
    default:
      break;
  }

  if (keyword !== undefined) {
    if (nodeId === undefined) {
      nodeId = "";
    } else if (!nodeId.endsWith(":")) {
      nodeId += ".";
    }
    nodeId += keyword;
  }

  return nodeId;
};

const getNodeName = (
  ts: typeof import("typescript"),
  node: ts.Node | undefined,
): string | undefined => {
  if (node === undefined) {
    return undefined;
  }

  let name: ts.Node;
  if (ts.isDeclaration(node)) {
    name = ts.getNameOfDeclaration(node) ?? node;
  } else {
    name = node;
  }

  switch (name.kind) {
    case ts.SyntaxKind.StringLiteral:
      if (
        ts.isIdentifierText(
          (name as ts.StringLiteral).text,
          ts.ScriptTarget.ESNext,
        )
      ) {
        return (name as ts.StringLiteral).text;
      }
      break;
    case ts.SyntaxKind.Identifier:
      return (name as ts.Identifier).text;
    case ts.SyntaxKind.PrivateIdentifier:
      return (name as ts.PrivateIdentifier).text.substring(1);
    case ts.SyntaxKind.FalseKeyword:
      return "false";
    case ts.SyntaxKind.NullKeyword:
      return "null";
    case ts.SyntaxKind.TrueKeyword:
      return "true";
    case ts.SyntaxKind.UndefinedKeyword:
      return "undefined";
    default:
      break;
  }

  return getNodeName(ts, node.parent);
};

export type { NodeIdOptions };
export { getNodeId, getNodeName };
