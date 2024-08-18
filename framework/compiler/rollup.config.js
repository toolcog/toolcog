import { defineLib } from "../../rollup.js";

export default [
  ...defineLib({ input: "./src/lib.ts", exports: "named" }),
  ...defineLib({
    input: "./src/cli/mod.ts",
    replace: (pkg) => ({
      __version__: JSON.stringify(pkg.version),
      preventAssignment: true,
      sourcemap: true,
    }),
  }),
];
