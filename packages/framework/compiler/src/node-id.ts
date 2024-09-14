import type ts from "typescript";
import { getCommentForNode } from "./comment.ts";

interface NodeIdOptions {
  package?: boolean | undefined;
  module?: boolean | undefined;

  host?: ts.ModuleResolutionHost | undefined;
  program?: ts.Program | undefined;
}

const getNodeTypeId = (
  ts: typeof import("typescript"),
  node: ts.Node | undefined,
  type?: ts.Type,
  options?: NodeIdOptions,
): string | undefined => {
  if (node === undefined) {
    return undefined;
  }

  let nodeId = getNodeId(ts, node, options);

  if (nodeId === undefined && type !== undefined) {
    const declaration = type.getSymbol()?.declarations?.[0];
    if (declaration !== undefined) {
      nodeId = getNodeId(ts, declaration, options);
    }
  }

  return nodeId;
};

const getNodeTypeIdentifier = (
  ts: typeof import("typescript"),
  node: ts.Node | undefined,
  type?: ts.Type,
): string | undefined => {
  if (node === undefined) {
    return undefined;
  }

  let nodeIdentifier = getNodeIdentifier(ts, node);

  if (nodeIdentifier === undefined && type !== undefined) {
    const declaration = type.getSymbol()?.declarations?.[0];
    if (declaration !== undefined) {
      nodeIdentifier = getNodeIdentifier(ts, declaration);
    }
  }

  return nodeIdentifier;
};

const getNodeId = (
  ts: typeof import("typescript"),
  node: ts.Node | undefined,
  options?: NodeIdOptions,
): string | undefined => {
  if (node === undefined) {
    return undefined;
  }

  const comment = getCommentForNode(ts, node);
  if (comment?.tags.id !== undefined) {
    return comment.tags.id.trim();
  }

  let nodeId = getNodePath(ts, node, options);

  if (ts.isSourceFile(node) && nodeId?.endsWith(":") === true) {
    nodeId = nodeId.substring(0, nodeId.length - 1);
  }

  return nodeId;
};

const getNodeIdentifier = (
  ts: typeof import("typescript"),
  node: ts.Node | undefined,
): string | undefined => {
  if (node === undefined) {
    return undefined;
  }

  const nodeName = getNodeName(ts, node);
  if (nodeName === undefined) {
    return getNodeIdentifier(ts, node.parent);
  }

  if (ts.isIdentifierText(nodeName, ts.ScriptTarget.ESNext)) {
    return nodeName;
  } else if (isFinite(parseInt(nodeName))) {
    const parentNodeName = getNodeIdentifier(ts, node.parent);
    if (parentNodeName !== undefined) {
      return parentNodeName + nodeName;
    }
  }

  return undefined;
};

const getNodePath = (
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
      let packageJsonInfo = node.packageJsonScope;
      if (
        packageJsonInfo === undefined &&
        options.host !== undefined &&
        options.program !== undefined
      ) {
        packageJsonInfo = ts.getPackageScopeForPath(
          node.fileName,
          ts.getTemporaryModuleResolutionState(
            options.program
              .getModuleResolutionCache()
              ?.getPackageJsonInfoCache(),
            options.host,
            options.program.getCompilerOptions(),
          ),
        );
      }
      packageName = packageJsonInfo?.contents.packageJsonContent.name;
    }

    let moduleName: string | undefined;
    if (options?.module === true && options.program !== undefined) {
      moduleName = ts.getExternalModuleNameFromPath(
        {
          getCanonicalFileName: options.program.getCanonicalFileName,
          getCommonSourceDirectory: options.program.getCommonSourceDirectory,
          getCurrentDirectory: options.program.getCurrentDirectory,
        },
        node.fileName,
      );
      moduleName = moduleName.replace("\\", "/");
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

  let nodePath = getNodePath(ts, node.parent, options);

  const nodeName = getNodeName(ts, node);
  if (nodeName !== undefined) {
    if (ts.isIdentifierText(nodeName, ts.ScriptTarget.ESNext)) {
      if (nodePath === undefined) {
        nodePath = "";
      } else if (!nodePath.endsWith(":")) {
        nodePath += ".";
      }
      nodePath += nodeName;
    } else {
      if (nodePath === undefined) {
        nodePath = "";
      }
      if (isFinite(parseInt(nodeName))) {
        nodePath += "[" + nodeName + "]";
      } else {
        nodePath += "[" + JSON.stringify(nodeName) + "]";
      }
    }
  }

  return nodePath;
};

const getNodeName = (
  ts: typeof import("typescript"),
  node: ts.Node | undefined,
): string | undefined => {
  if (node === undefined) {
    return undefined;
  }

  const comment = getCommentForNode(ts, node);
  if (comment?.tags.noid !== undefined) {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (node.parent !== undefined && ts.isArrayLiteralExpression(node.parent)) {
    const index = node.parent.elements.findIndex((element) => element === node);
    if (index >= 0) {
      return String(index);
    }
    return undefined;
  }

  switch (node.kind) {
    case ts.SyntaxKind.PropertyAccessExpression:
      return getNodeText(ts, (node as ts.PropertyAccessExpression).name);
    case ts.SyntaxKind.ElementAccessExpression:
      return getNodeText(
        ts,
        (node as ts.ElementAccessExpression).argumentExpression,
      );
    case ts.SyntaxKind.VariableDeclaration:
      return getNodeText(ts, (node as ts.VariableDeclaration).name);
    case ts.SyntaxKind.FunctionDeclaration:
      return getNodeText(ts, (node as ts.FunctionDeclaration).name);
    case ts.SyntaxKind.ClassDeclaration:
      return getNodeText(ts, (node as ts.ClassDeclaration).name);
    case ts.SyntaxKind.ModuleDeclaration:
      return getNodeText(ts, (node as ts.ModuleDeclaration).name);
    case ts.SyntaxKind.PropertyAssignment:
      return getNodeText(ts, (node as ts.PropertyAssignment).name);
    case ts.SyntaxKind.ShorthandPropertyAssignment:
      return getNodeText(ts, (node as ts.ShorthandPropertyAssignment).name);
    default:
      return undefined;
  }
};

const getNodeText = (
  ts: typeof import("typescript"),
  node: ts.Node | undefined,
): string | undefined => {
  if (node === undefined) {
    return undefined;
  }

  switch (node.kind) {
    case ts.SyntaxKind.StringLiteral:
      return (node as ts.StringLiteral).text;
    case ts.SyntaxKind.Identifier:
      return (node as ts.Identifier).text;
    case ts.SyntaxKind.PrivateIdentifier:
      return (node as ts.PrivateIdentifier).text;
    case ts.SyntaxKind.FalseKeyword:
      return "false";
    case ts.SyntaxKind.NullKeyword:
      return "null";
    case ts.SyntaxKind.TrueKeyword:
      return "true";
    case ts.SyntaxKind.UndefinedKeyword:
      return "undefined";
    default:
      return undefined;
  }
};

export type { NodeIdOptions };
export { getNodeTypeId, getNodeTypeIdentifier, getNodeId, getNodeIdentifier };
