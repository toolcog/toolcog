import { defineLib } from "../../../rollup.js";

export default defineLib({
  input: [
    "./src/lib.ts",
    "./quiet/src/mod.ts",
    "./loader/src/mod.ts",
    "./register/src/mod.ts",
  ],
  replace: (pkg) => ({
    __version__: JSON.stringify(pkg.version),
    preventAssignment: true,
    sourcemap: true,
  }),
});
