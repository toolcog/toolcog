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
  UnableToStaticallyAnalyzeSyntax: {
    key: "UnableToStaticallyAnalyzeSyntax",
    category: ts.DiagnosticCategory.Error,
    code: 900003,
    message: "Unable to statically analyze {0}",
  },
  UnableToConstructSchemaForType: {
    key: "UnableToConstructSchemaForType",
    category: ts.DiagnosticCategory.Error,
    code: 900004,
    message: "Unable to construct schema for type `{0}`",
  },
  UnsupportedToolProperty: {
    key: "UnsupportedToolProperty",
    category: ts.DiagnosticCategory.Warning,
    code: 900005,
    message: "Unsupported tool property",
  },
  MissingToolComment: {
    key: "MissingToolComment",
    category: ts.DiagnosticCategory.Warning,
    code: 900006,
    message: "Missing tool comment",
  },
} as const satisfies Record<string, ts.DiagnosticMessage>;

export { Diagnostics };
