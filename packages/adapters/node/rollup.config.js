import { defineLib } from "../../../rollup.js";

export default defineLib({
  input: [
    "./quiet/src/mod.ts",
    "./loader/src/mod.ts",
    "./register/src/mod.ts",
    "./installer/src/mod.ts",
    "./src/lib.ts",
  ],
  replace: (pkg) => ({
    __version__: JSON.stringify(pkg.version),
    preventAssignment: true,
    sourcemap: true,
  }),
});
