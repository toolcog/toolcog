import type ts from "typescript";

declare module "typescript" {
  function isBlockScope(
    node: ts.Node,
    parentNode: ts.Node | undefined,
  ): boolean;
}
