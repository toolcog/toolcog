import type ts from "typescript";

interface ToolcogHost {
  readonly ts: typeof ts;
  readonly factory: ts.NodeFactory;
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly context: ts.TransformationContext | undefined;
  readonly moduleResolutionHost: ts.ModuleResolutionHost;

  readonly addDiagnostic: (diagnostic: ts.Diagnostic) => void;
}

export type { ToolcogHost };
