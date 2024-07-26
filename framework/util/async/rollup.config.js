import { defineLib } from "@toolcog/config/rollup.js";

export default [
  ...defineLib({ outputName: "lib.node", exportConditions: ["node"] }),
  ...defineLib({ outputName: "lib.polyfill" }),
];
