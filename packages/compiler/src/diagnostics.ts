import ts from "typescript";

const Diagnostics = {
  UnableToResolveModule: {
    key: "UnableToResolveModule",
    category: ts.DiagnosticCategory.Error,
    code: 900001,
    message: 'Unable to resolve module "{0}".',
  },
  CannotGetSourceFileForModule: {
    key: "CannotGetSourceFileForModule",
    category: ts.DiagnosticCategory.Error,
    code: 900002,
    message: 'Cannot get source file "{0}" for module "{1}".',
  },
  ModuleHasNoExportedMember: {
    key: "ModuleHasNoExportedMember",
    category: ts.DiagnosticCategory.Error,
    code: 900003,
    message: 'Module "{0}" has no exported member `{1}`.',
  },
  CannotFindDeclarationForExportedMemberOfModule: {
    key: "CannotFindDeclarationForExportedMemberOfModule",
    category: ts.DiagnosticCategory.Error,
    code: 900004,
    message:
      'Cannot find declaration for exported member `{0}` of module "{1}".',
  },
  CannotTransformHomogeneousArray: {
    key: "CannotTransformHomogeneousArray",
    category: ts.DiagnosticCategory.Warning,
    code: 900005,
    message: "Cannot transform homogenous array `{0}`.",
  },
  CannotTransformSplicedArray: {
    key: "CannotTransformSplicedArray",
    category: ts.DiagnosticCategory.Warning,
    code: 900006,
    message: "Cannot transform spliced array.",
  },
  CannotTransformNonStableProperty: {
    key: "CannotTransformNonStableProperty",
    category: ts.DiagnosticCategory.Warning,
    code: 900007,
    message: 'Cannot transform non-stable property "{0}".',
  },
  CannotDeriveSchemaForType: {
    key: "CannotDeriveSchemaForType",
    category: ts.DiagnosticCategory.Error,
    code: 900008,
    message: "Cannot derive a schema for type `{0}`.",
  },
  CommentNeededToDescribeToolToLLM: {
    key: "CommentNeededToDescribeToolToLLM",
    category: ts.DiagnosticCategory.Warning,
    code: 900009,
    message: "Comment needed to describe tool to LLM.",
  },
  CommentNeededToDescribeFunctionToLLM: {
    key: "CommentNeededToDescribeFunctionToLLM",
    category: ts.DiagnosticCategory.Warning,
    code: 900010,
    message: "Comment needed to describe function to LLM.",
  },
  CommentNeededToDefineEmbedding: {
    key: "CommentNeededToDefineEmbedding",
    category: ts.DiagnosticCategory.Warning,
    code: 900011,
    message: "Comment needed to generate embedding.",
  },
  CannotExtractIdiomIdFromReference: {
    key: "CannotExtractIdiomIdFromReference",
    category: ts.DiagnosticCategory.Warning,
    code: 900012,
    message: "Cannot extract idiom ID from reference.",
  },
  CannotExtractIdiomIdsFromArrayReference: {
    key: "CannotExtractIdiomIdsFromArrayReference",
    category: ts.DiagnosticCategory.Warning,
    code: 900012,
    message: "Cannot extract idiom IDs from array reference.",
  },
} as const satisfies Record<string, ts.DiagnosticMessage>;

export { Diagnostics };
