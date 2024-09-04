import { defineLib } from "../../../rollup.js";

export default defineLib({
  exports: "named",
  replace: (pkg) => ({
    __version__: JSON.stringify(pkg.version),
    preventAssignment: true,
    sourcemap: true,
  }),
});
