import replace from "@rollup/plugin-replace";
import { defineLib } from "@toolcog/config/rollup.js";
//import pkg from "../package.json" with { type: "json" };
import { readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("../package.json", "utf-8"));

export default defineLib({
  plugins: [
    replace({
      __version__: JSON.stringify(pkg.version),
      __description__: JSON.stringify(pkg.description),
      preventAssignment: true,
      sourcemap: true,
    }),
  ],
});
