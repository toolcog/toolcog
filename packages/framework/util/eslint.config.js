import config from "../../../eslint.config.js";

export default [
  ...config,
  {
    ignores: [
      "emit/src/emitter.ts", // crashes typescript-eslint 8.6
      "tty/src/width.ts", // takes an eternity to lint
    ],
  },
];
