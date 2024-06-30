import type ts from "typescript";

declare module "typescript" {
  function isBlockScope(
    node: ts.Node,
    parentNode: ts.Node | undefined,
  ): boolean;

  interface TypeChecker {
    getAwaitedType(
      type: ts.Type,
      errorNode?: ts.Node,
      diagnosticMessage?: ts.DiagnosticMessage,
      ...args: ts.DiagnosticArguments
    ): ts.Type | undefined;
  }

  interface TransformationContext {
    addDiagnostic(diagnostic: ts.Diagnostic): void;
  }

  type DiagnosticArguments = (string | number)[];

  function createDiagnosticForNode(
    node: ts.Node,
    message: ts.DiagnosticMessage,
    ...args: ts.DiagnosticArguments
  ): ts.Diagnostic;

  function createCompilerDiagnostic(
    message: ts.DiagnosticMessage,
    ...args: ts.DiagnosticArguments
  ): ts.Diagnostic;

  namespace Debug {
    function fail(message?: string): never;

    function assert(
      expression: unknown,
      message?: string,
      verboseDebugInfo?: string | (() => string),
    ): asserts expression;
  }
}
