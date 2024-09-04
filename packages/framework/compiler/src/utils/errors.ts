import type ts from "typescript";

const createError = (
  ts: typeof import("typescript"),
  location: ts.Node | undefined,
  message: ts.DiagnosticMessage,
  ...args: ts.DiagnosticArguments
): ts.Diagnostic => {
  if (location !== undefined && location.pos >= 0) {
    return ts.createDiagnosticForNode(location, message, ...args);
  } else {
    return ts.createCompilerDiagnostic(message, ...args);
  }
};

const error = (
  ts: typeof import("typescript"),
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  location: ts.Node | undefined,
  message: ts.DiagnosticMessage,
  ...args: ts.DiagnosticArguments
): ts.Diagnostic => {
  const diagnostic = createError(ts, location, message, ...args);
  addDiagnostic(diagnostic);
  return diagnostic;
};

const abort = (
  ts: typeof import("typescript"),
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  location: ts.Node | undefined,
  message: ts.DiagnosticMessage,
  ...args: ts.DiagnosticArguments
): never => {
  const diagnostic = error(ts, addDiagnostic, location, message, ...args);
  throw new Error(diagnostic.messageText as string);
};

export { createError, error, abort };
