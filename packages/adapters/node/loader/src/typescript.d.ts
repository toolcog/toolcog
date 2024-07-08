import type ts from "typescript";

declare module "typescript" {
  type GetCanonicalFileName = (fileName: string) => string;
  function createGetCanonicalFileName(
    useCaseSensitiveFileNames: boolean,
  ): ts.GetCanonicalFileName;

  function getDirectoryPath(path: Path): Path;
  function getDirectoryPath(path: string): string;

  function normalizePath(path: string): string;

  interface System {
    getEnvironmentVariable(name: string): string;
  }
}
