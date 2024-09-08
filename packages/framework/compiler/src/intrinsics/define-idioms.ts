import type ts from "typescript";
import type { ModuleDef } from "@toolcog/runtime";
import { error } from "../utils/errors.ts";
import { Diagnostics } from "../diagnostics.ts";
import { defineIdiomExpression } from "./define-idiom.ts";

const defineIdiomsExpression = (
  ts: typeof import("typescript"),
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  moduleDef: ModuleDef,
  idiomType: ts.Type,
  idiomsType: ts.Type,
  idiomResolverExpression: ts.Expression | undefined,
  valuesExpression: ts.Expression,
  valuesType: ts.Type,
  errorNode: ts.Node,
  idiomIds?: string[],
): ts.Expression => {
  // Check for previously compiled idioms.
  if (checker.isTypeAssignableTo(valuesType, idiomsType)) {
    return valuesExpression;
  }

  // Unwrap `as` expressions.
  if (ts.isAsExpression(valuesExpression)) {
    valuesExpression = valuesExpression.expression;
  }

  const idiomExpressions: ts.Expression[] = [];

  // Transform literal idioms array.
  if (ts.isArrayLiteralExpression(valuesExpression)) {
    for (const element of valuesExpression.elements) {
      if (ts.isSpreadElement(element)) {
        const spreadType = checker.getTypeAtLocation(element.expression);
        if (!checker.isTypeAssignableTo(spreadType, idiomsType)) {
          error(
            ts,
            addDiagnostic,
            element,
            Diagnostics.CannotTransformSplicedArray,
          );
          continue;
        }
        idiomExpressions.push(element);
        continue;
      }

      idiomExpressions.push(
        defineIdiomExpression(
          ts,
          host,
          program,
          factory,
          checker,
          addDiagnostic,
          moduleDef,
          idiomType,
          idiomResolverExpression,
          element,
          checker.getTypeAtLocation(element),
          element,
          idiomIds,
        ),
      );
    }
    return factory.updateArrayLiteralExpression(
      valuesExpression,
      idiomExpressions,
    );
  }

  // Check for un-transformable homogeneously typed arrays.
  if (!checker.isTupleType(valuesType)) {
    error(
      ts,
      addDiagnostic,
      errorNode,
      Diagnostics.CannotTransformHomogeneousArray,
      checker.typeToString(valuesType),
    );
    return factory.createArrayLiteralExpression([]);
  }

  // Transform idioms array expression.
  for (const property of valuesType.getApparentProperties()) {
    const index = parseInt(property.name);
    if (!isFinite(index)) {
      continue;
    }
    idiomExpressions.push(
      defineIdiomExpression(
        ts,
        host,
        program,
        factory,
        checker,
        addDiagnostic,
        moduleDef,
        idiomType,
        idiomResolverExpression,
        factory.createElementAccessExpression(valuesExpression, index),
        checker.getTypeOfSymbolAtLocation(property, valuesExpression),
        errorNode,
        idiomIds,
      ),
    );
  }
  return factory.createArrayLiteralExpression(idiomExpressions, true);
};

export { defineIdiomsExpression };
