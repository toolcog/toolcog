import config from "../../../eslint.config.js";

export default [
  ...config,
  {
    ignores: [
      "src/emit/emitter.ts", // crashes typescript-eslint 8.6
      "src/tty/width.ts", // takes an eternity to lint
    ],
  },
];
