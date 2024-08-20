import { defineLib } from "../../rollup.js";

export default defineLib({
  input: [
    "./src/lib.ts",
    "./src/quiet/mod.ts",
    "./src/loader/mod.ts",
    "./src/register/mod.ts",
  ],
  replace: (pkg) => ({
    __version__: JSON.stringify(pkg.version),
    preventAssignment: true,
    sourcemap: true,
  }),
});
