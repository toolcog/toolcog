import { defineLib } from "../../rollup.js";

export default [
  ...defineLib({ input: "./src/lib.ts" }),
  ...defineLib({ input: "./src/json/mod.ts" }),
  ...defineLib({ input: "./src/cache/mod.ts" }),
  ...defineLib({ input: "./src/queue/mod.ts" }),
  ...defineLib({ input: "./src/emit/mod.ts" }),
  ...defineLib({ input: "./src/task/mod.ts" }),
  ...defineLib({
    input: "./src/async/mod.ts",
    outputTag: "node",
    exportConditions: ["node"],
  }),
  ...defineLib({
    input: "./src/async/mod.ts",
    outputTag: "polyfill",
  }),
  ...defineLib({ input: ["./src/timer/mod.ts"] }),
  ...defineLib({ input: "./src/tty/mod.ts" }),
  ...defineLib({ input: "./src/tui/mod.ts" }),
];
