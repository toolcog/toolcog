import { defineLib } from "../../rollup.js";

export default defineLib({
  replace: (pkg) => ({
    __version__: JSON.stringify(pkg.version),
    preventAssignment: true,
    sourcemap: true,
  }),
});
