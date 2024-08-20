import ts from "typescript";

const classifyInput = (
  scanner: ts.Scanner,
  source: string,
): "lang" | "code" | "cont" => {
  scanner.setText(source);

  // Natural language heuristic.
  let lastToken: ts.SyntaxKind | undefined;
  let tokenCount = 0;
  let identifiersInRun = 0;

  // Punctuation counters.
  let parenthesisCount = 0;
  let braceCount = 0;
  let bracketCount = 0;

  // Trailing comment state.
  let atComment = false;
  let atNewLine = false;

  try {
    // Scan the source code.
    while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
      const token = scanner.getToken();
      tokenCount += 1;

      try {
        if (braceCount === 0 && bracketCount === 0) {
          switch (token) {
            case ts.SyntaxKind.Unknown:
              return "lang";
            case ts.SyntaxKind.StringLiteral:
              if (lastToken === ts.SyntaxKind.Identifier) {
                return "lang";
              }
              break;
            case ts.SyntaxKind.Identifier:
              identifiersInRun += 1;
              if (identifiersInRun === 2) {
                return "lang";
              }
              continue;
            case ts.SyntaxKind.AbstractKeyword:
            case ts.SyntaxKind.AccessorKeyword:
            case ts.SyntaxKind.AnyKeyword:
            case ts.SyntaxKind.AsKeyword:
            case ts.SyntaxKind.AssertsKeyword:
            case ts.SyntaxKind.AssertKeyword:
            case ts.SyntaxKind.AsyncKeyword:
            case ts.SyntaxKind.AwaitKeyword:
            case ts.SyntaxKind.BigIntKeyword:
            case ts.SyntaxKind.BooleanKeyword:
            case ts.SyntaxKind.BreakKeyword:
            case ts.SyntaxKind.CaseKeyword:
            case ts.SyntaxKind.CatchKeyword:
            case ts.SyntaxKind.ClassKeyword:
            case ts.SyntaxKind.ConstKeyword:
            case ts.SyntaxKind.ConstructorKeyword:
            case ts.SyntaxKind.ContinueKeyword:
            case ts.SyntaxKind.DebuggerKeyword:
            case ts.SyntaxKind.DeclareKeyword:
            case ts.SyntaxKind.DefaultKeyword:
            case ts.SyntaxKind.DeleteKeyword:
            case ts.SyntaxKind.DoKeyword:
            case ts.SyntaxKind.ElseKeyword:
            case ts.SyntaxKind.EnumKeyword:
            case ts.SyntaxKind.ExportKeyword:
            case ts.SyntaxKind.ExtendsKeyword:
            case ts.SyntaxKind.FalseKeyword:
            case ts.SyntaxKind.FinallyKeyword:
            case ts.SyntaxKind.ForKeyword:
            case ts.SyntaxKind.FromKeyword:
            case ts.SyntaxKind.FunctionKeyword:
            case ts.SyntaxKind.GetKeyword:
            case ts.SyntaxKind.GlobalKeyword:
            case ts.SyntaxKind.IfKeyword:
            case ts.SyntaxKind.ImplementsKeyword:
            case ts.SyntaxKind.ImportKeyword:
            case ts.SyntaxKind.InferKeyword:
            case ts.SyntaxKind.InKeyword:
            case ts.SyntaxKind.InterfaceKeyword:
            case ts.SyntaxKind.IntrinsicKeyword:
            case ts.SyntaxKind.IsKeyword:
            case ts.SyntaxKind.KeyOfKeyword:
            case ts.SyntaxKind.LetKeyword:
            case ts.SyntaxKind.ModuleKeyword:
            case ts.SyntaxKind.NamespaceKeyword:
            case ts.SyntaxKind.NeverKeyword:
            case ts.SyntaxKind.NewKeyword:
            case ts.SyntaxKind.NullKeyword:
            case ts.SyntaxKind.NumberKeyword:
            case ts.SyntaxKind.ObjectKeyword:
            case ts.SyntaxKind.OfKeyword:
            case ts.SyntaxKind.PackageKeyword:
            case ts.SyntaxKind.PrivateKeyword:
            case ts.SyntaxKind.ProtectedKeyword:
            case ts.SyntaxKind.PublicKeyword:
            case ts.SyntaxKind.ReadonlyKeyword:
            case ts.SyntaxKind.OutKeyword:
            case ts.SyntaxKind.OverrideKeyword:
            case ts.SyntaxKind.RequireKeyword:
            case ts.SyntaxKind.ReturnKeyword:
            case ts.SyntaxKind.SatisfiesKeyword:
            case ts.SyntaxKind.SetKeyword:
            case ts.SyntaxKind.StaticKeyword:
            case ts.SyntaxKind.StringKeyword:
            case ts.SyntaxKind.SuperKeyword:
            case ts.SyntaxKind.SwitchKeyword:
            case ts.SyntaxKind.SymbolKeyword:
            case ts.SyntaxKind.ThisKeyword:
            case ts.SyntaxKind.ThrowKeyword:
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.TryKeyword:
            case ts.SyntaxKind.TypeKeyword:
            case ts.SyntaxKind.TypeOfKeyword:
            case ts.SyntaxKind.UndefinedKeyword:
            case ts.SyntaxKind.UniqueKeyword:
            case ts.SyntaxKind.UnknownKeyword:
            case ts.SyntaxKind.UsingKeyword:
            case ts.SyntaxKind.VarKeyword:
            case ts.SyntaxKind.VoidKeyword:
            case ts.SyntaxKind.WhileKeyword:
            case ts.SyntaxKind.WithKeyword:
            case ts.SyntaxKind.YieldKeyword:
              // These keywords don't reset identifier runs.
              continue;
            case ts.SyntaxKind.NewLineTrivia:
            case ts.SyntaxKind.WhitespaceTrivia:
              break;
            case ts.SyntaxKind.CommaToken:
              // Commas reset identifier runs when not parenthesized.
              if (parenthesisCount !== 0) {
                identifiersInRun = 0;
              }
              break;
            case ts.SyntaxKind.InstanceOfKeyword:
            default:
              identifiersInRun = 0;
              break;
          }
        }

        switch (token) {
          case ts.SyntaxKind.OpenParenToken:
            parenthesisCount += 1;
            break;
          case ts.SyntaxKind.CloseParenToken:
            parenthesisCount -= 1;
            break;
          case ts.SyntaxKind.OpenBraceToken:
            braceCount += 1;
            break;
          case ts.SyntaxKind.CloseBraceToken:
            braceCount -= 1;
            break;
          case ts.SyntaxKind.OpenBracketToken:
            bracketCount += 1;
            break;
          case ts.SyntaxKind.CloseBracketToken:
            bracketCount -= 1;
            break;
          case ts.SyntaxKind.SingleLineCommentTrivia:
          case ts.SyntaxKind.MultiLineCommentTrivia:
            atComment = true;
            atNewLine = false;
            break;
          case ts.SyntaxKind.NewLineTrivia:
            if (atNewLine) {
              atComment = false;
            }
            atNewLine = true;
            break;
          default:
            atComment = false;
            atNewLine = false;
            break;
        }

        if (parenthesisCount < 0 || braceCount < 0 || bracketCount < 0) {
          return "code";
        }
      } finally {
        switch (token) {
          case ts.SyntaxKind.NewLineTrivia:
          case ts.SyntaxKind.WhitespaceTrivia:
            break;
          default:
            lastToken = token;
        }
      }
    }

    // Treat any input that ends with a dot or question mark as language.
    switch (lastToken) {
      case ts.SyntaxKind.DotToken:
      case ts.SyntaxKind.DotDotDotToken:
      case ts.SyntaxKind.QuestionToken:
        return "lang";
      default:
        break;
    }

    // Verify that all punctuation is balanced,
    // and that the input does not end with a comment.
    if (
      parenthesisCount === 0 &&
      braceCount === 0 &&
      bracketCount === 0 &&
      !atComment
    ) {
      return "code";
    } else {
      return "cont";
    }
  } finally {
    scanner.setText(undefined);
  }
};

export { classifyInput };
