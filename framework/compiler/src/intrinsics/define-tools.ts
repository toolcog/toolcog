import type ts from "typescript";
import { error } from "../utils/errors.ts";
import { Diagnostics } from "../diagnostics.ts";
import type { ToolcogManifest } from "../manifest.ts";
import { defineToolExpression } from "./define-tool.ts";

const defineToolsExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  getCommonSourceDirectory: (() => string) | undefined,
  manifest: ToolcogManifest,
  toolType: ts.Type,
  toolsType: ts.Type,
  funcsExpression: ts.Expression,
  funcsType: ts.Type,
  errorNode: ts.Node,
): ts.Expression => {
  // Check for previously compiled tools.
  if (checker.isTypeAssignableTo(funcsType, toolsType)) {
    return funcsExpression;
  }

  // Unwrap `as` expressions.
  if (ts.isAsExpression(funcsExpression)) {
    funcsExpression = funcsExpression.expression;
  }

  const toolExpressions: ts.Expression[] = [];

  // Transform literal tools array.
  if (ts.isArrayLiteralExpression(funcsExpression)) {
    for (const element of funcsExpression.elements) {
      if (ts.isSpreadElement(element)) {
        const spreadType = checker.getTypeAtLocation(element.expression);
        if (!checker.isTypeAssignableTo(spreadType, toolsType)) {
          error(
            ts,
            addDiagnostic,
            element,
            Diagnostics.CannotTransformSplicedArray,
          );
          continue;
        }
        toolExpressions.push(element);
        continue;
      }

      toolExpressions.push(
        defineToolExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          getCommonSourceDirectory,
          manifest,
          toolType,
          element,
          checker.getTypeAtLocation(element),
          element,
        ),
      );
    }
    return factory.updateArrayLiteralExpression(
      funcsExpression,
      toolExpressions,
    );
  }

  // Check for un-transformable homogeneously typed arrays.
  if (!checker.isTupleType(funcsType)) {
    error(
      ts,
      addDiagnostic,
      errorNode,
      Diagnostics.CannotTransformHomogeneousArray,
      checker.typeToString(funcsType),
    );
    return factory.createArrayLiteralExpression([]);
  }

  // Transform tools array expression.
  for (const property of funcsType.getApparentProperties()) {
    const index = parseInt(property.name);
    if (!isFinite(index)) {
      continue;
    }
    toolExpressions.push(
      defineToolExpression(
        ts,
        factory,
        checker,
        addDiagnostic,
        getCommonSourceDirectory,
        manifest,
        toolType,
        factory.createElementAccessExpression(funcsExpression, index),
        checker.getTypeOfSymbolAtLocation(property, funcsExpression),
        errorNode,
      ),
    );
  }
  return factory.createArrayLiteralExpression(toolExpressions, true);
};

export { defineToolsExpression };
