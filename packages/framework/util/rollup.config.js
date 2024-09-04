import { defineLib } from "../../../rollup.js";

export default [
  ...defineLib({ input: "./src/lib.ts" }),
  ...defineLib({ input: "./json/src/mod.ts" }),
  ...defineLib({ input: "./cache/src/mod.ts" }),
  ...defineLib({ input: "./queue/src/mod.ts" }),
  ...defineLib({ input: "./emit/src/mod.ts" }),
  ...defineLib({ input: "./task/src/mod.ts" }),
  ...defineLib({
    input: "./async/src/mod.ts",
    outputTag: "node",
    exportConditions: ["node"],
  }),
  ...defineLib({
    input: "./async/src/mod.ts",
    outputTag: "polyfill",
  }),
  ...defineLib({ input: "./timer/src/mod.ts" }),
  ...defineLib({ input: "./tty/src/mod.ts" }),
  ...defineLib({ input: "./tui/src/mod.ts" }),
];
