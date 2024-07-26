import type ts from "typescript";

declare module "typescript" {
  interface AutoGenerateInfo {
    flags: ts.GeneratedIdentifierFlags;
    readonly id: number;
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    readonly prefix?: string | ts.GeneratedNamePart;
    readonly suffix?: string;
  }

  interface GeneratedIdentifier extends ts.Identifier {
    readonly emitNode: { autoGenerate: ts.AutoGenerateInfo };
    //readonly emitNode: ts.EmitNode & { autoGenerate: ts.AutoGenerateInfo };
  }

  function isGeneratedIdentifier(node: ts.Node): node is ts.GeneratedIdentifier;

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
    addDiagnostic?(diagnostic: ts.Diagnostic): void;
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
