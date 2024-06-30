import type ts from "typescript";
import type { ToolcogHost } from "../host.ts";

const createError = (
  host: ToolcogHost,
  location: ts.Node | undefined,
  message: ts.DiagnosticMessage,
  ...args: ts.DiagnosticArguments
): ts.Diagnostic => {
  if (location !== undefined) {
    return host.ts.createDiagnosticForNode(location, message, ...args);
  } else {
    return host.ts.createCompilerDiagnostic(message, ...args);
  }
};

const error = (
  host: ToolcogHost,
  location: ts.Node | undefined,
  message: ts.DiagnosticMessage,
  ...args: ts.DiagnosticArguments
): ts.Diagnostic => {
  const diagnostic = createError(host, location, message, ...args);
  host.addDiagnostic(diagnostic);
  return diagnostic;
};

const abort = (
  host: ToolcogHost,
  location: ts.Node | undefined,
  message: ts.DiagnosticMessage,
  ...args: ts.DiagnosticArguments
): never => {
  const diagnostic = error(host, location, message, ...args);
  throw new Error(diagnostic.messageText as string);
};

export { createError, error, abort };
