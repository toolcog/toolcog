import { defineLib } from "../../rollup.js";

export default defineLib({
  input: ["./src/lib.ts", "./src/loader/mod.ts", "./src/quiet/mod.ts"],
  replace: (pkg) => ({
    __version__: JSON.stringify(pkg.version),
    preventAssignment: true,
    sourcemap: true,
  }),
});
