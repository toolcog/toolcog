import ts from "typescript";

const Diagnostics = {
  UnableToResolve: {
    key: "UnableToResolve",
    category: ts.DiagnosticCategory.Error,
    code: 900001,
    message: 'Unable to resolve `{0}` from "{1}"',
  },
  UnableToResolveType: {
    key: "UnableToResolveType",
    category: ts.DiagnosticCategory.Error,
    code: 900002,
    message: 'Unable to resolve type `{0}` from "{1}"',
  },
  UnableToConstructSchemaForType: {
    key: "UnableToConstructSchemaForType",
    category: ts.DiagnosticCategory.Error,
    code: 900003,
    message: "Unable to construct schema for type `{0}`",
  },
  UnableToDetermineToolName: {
    key: "UnableToDetermineToolName",
    category: ts.DiagnosticCategory.Error,
    code: 900004,
    message: "Unable to determine tool name",
  },
  UnableToExtractTool: {
    key: "UnableToExtractTool",
    category: ts.DiagnosticCategory.Error,
    code: 900005,
    message: "Unable to extract tool from {0}",
  },
  MissingToolComment: {
    key: "MissingToolComment",
    category: ts.DiagnosticCategory.Warning,
    code: 900006,
    message: "Missing tool comment",
  },
} as const satisfies Record<string, ts.DiagnosticMessage>;

export { Diagnostics };
